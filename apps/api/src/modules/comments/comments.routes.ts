import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../../config/env";
import { getActiveRestriction } from "../restrictions/restrictions.service";
import { assertCooldown, assertRateLimit } from "./antispam.service";
import { syncPostCommentsCount } from "./comments.service";
import { resolveOpenReportsForComment } from "../admin/moderation/comment-reports.service";
import { sendModerationChatReportNotification } from "./comment-report-notify";

const createBodySchema = z.object({
  text: z.string().trim().min(1).max(env.MAX_COMMENT_LENGTH),
  attachmentIds: z.array(z.string()).max(env.MAX_ATTACHMENTS_PER_COMMENT).default([]),
  replyToCommentId: z.string().min(1).optional()
});

const updateBodySchema = z.object({
  text: z.string().trim().min(1).max(env.MAX_COMMENT_LENGTH)
});

const reportBodySchema = z.object({
  reason: z.string().max(2000).optional()
});

function getUserId(request: any) {
  return request.headers["x-user-id"] as string | undefined;
}

function isRegularComment(kind: string): boolean {
  return kind === "comment";
}

const REPLY_SNIPPET_MAX = 110;
const REPLY_FALLBACK_EMPTY = "Без текста";
const REPLY_FALLBACK_DELETED = "Сообщение удалено";
const REPLY_FALLBACK_HIDDEN = "Комментарий скрыт";

function displayNameForReply(author: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
} | null | undefined): string {
  if (!author) return "Пользователь";
  const full = [author.firstName, author.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (author.username && author.username.trim()) {
    return author.username.startsWith("@") ? author.username : `@${author.username}`;
  }
  return "Пользователь";
}

function snippetText(text: string | null | undefined): string {
  const normalized = (text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return REPLY_FALLBACK_EMPTY;
  if (normalized.length <= REPLY_SNIPPET_MAX) return normalized;
  return `${normalized.slice(0, REPLY_SNIPPET_MAX - 1).trimEnd()}…`;
}

export const commentsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/posts/:postId/comments", async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const query = request.query as { cursor?: string; limit?: string; includeHidden?: string };
    const limit = Math.min(Number(query.limit ?? 20), 50);
    const includeHidden =
      query.includeHidden === "true" && Boolean(request.platformUser?.isModerator);

    const comments = await app.prisma.comment.findMany({
      where: {
        postId,
        status: includeHidden ? { in: ["active", "hidden"] } : "active"
      },
      orderBy: [{ kind: "desc" }, { createdAt: "asc" }],
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1
          }
        : {}),
      take: limit,
      include: {
        author: true,
        attachments: true,
        replyToComment: {
          include: {
            author: true
          }
        }
      }
    });

    return {
      items: comments.map((comment) => ({
        ...comment,
        systemAuthorName: comment.kind === "thread_header" ? comment.systemAuthor ?? null : null,
        replyPreview:
          comment.replyToCommentId && comment.replyToComment
            ? {
                id: comment.replyToComment.id,
                authorName:
                  comment.replyToComment.kind === "thread_header"
                    ? comment.replyToComment.systemAuthor ?? "Канал"
                    : displayNameForReply(comment.replyToComment.author),
                textSnippet:
                  comment.replyToComment.status === "deleted"
                    ? REPLY_FALLBACK_DELETED
                    : comment.replyToComment.status === "hidden"
                      ? REPLY_FALLBACK_HIDDEN
                      : snippetText(comment.replyToComment.text),
                isDeleted: comment.replyToComment.status === "deleted",
                isSystem: comment.replyToComment.kind !== "comment"
              }
            : null
      }))
    };
  });

  app.post("/api/posts/:postId/comments", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "x-user-id header is required" });
    }
    const { postId } = request.params as { postId: string };
    const parsed = createBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid request body" });
    }

    const restriction = await getActiveRestriction(app.prisma, userId);
    if (restriction) {
      return reply.code(403).send({
        error: "commenting disabled for user",
        restrictionType: restriction.restrictionType,
        endsAt: restriction.endsAt
      });
    }

    const post = await app.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return reply.code(404).send({ error: "post not found" });
    }

    try {
      assertRateLimit(userId, postId);
      assertCooldown(userId, postId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "rate limited";
      return reply.code(429).send({ error: msg });
    }

    let replyToCommentId: string | null = null;
    let replyParentValid = false;
    if (parsed.data.replyToCommentId) {
      const parent = await app.prisma.comment.findUnique({
        where: { id: parsed.data.replyToCommentId },
        select: { id: true, postId: true, status: true, kind: true }
      });
      if (!parent) {
        return reply.code(400).send({ error: "reply target not found" });
      }
      if (parent.postId !== postId) {
        return reply.code(400).send({ error: "reply target belongs to another post" });
      }
      if (!isRegularComment(parent.kind)) {
        return reply.code(400).send({ error: "reply target must be a regular comment" });
      }
      replyToCommentId = parent.id;
      replyParentValid = true;
    }

    const comment = await app.prisma.comment.create({
      data: {
        postId,
        authorId: userId,
        kind: "comment",
        replyToCommentId,
        text: parsed.data.text,
        status: "active"
      }
    });

    if (parsed.data.attachmentIds.length > 0) {
      await app.prisma.commentAttachment.updateMany({
        where: { id: { in: parsed.data.attachmentIds }, commentId: null },
        data: { commentId: comment.id }
      });
    }

    await syncPostCommentsCount(app, postId);
    request.log.info(
      {
        route: "/api/posts/:postId/comments",
        postId,
        newCommentId: comment.id,
        replyToCommentId,
        replyParentValid
      },
      "comment created"
    );
    return reply.code(201).send(comment);
  });

  app.patch("/api/comments/:commentId", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "x-user-id header is required" });
    }
    const { commentId } = request.params as { commentId: string };
    const parsed = updateBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid request body" });
    }

    const comment = await app.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.status === "deleted") {
      return reply.code(404).send({ error: "comment not found" });
    }
    if (!isRegularComment(comment.kind)) {
      return reply.code(403).send({ error: "system comments are read-only" });
    }
    if (comment.authorId !== userId) {
      return reply.code(403).send({ error: "can edit only own comments" });
    }
    if (env.COMMENT_EDIT_WINDOW_MINUTES > 0) {
      const deadline = comment.createdAt.getTime() + env.COMMENT_EDIT_WINDOW_MINUTES * 60000;
      if (Date.now() > deadline) {
        return reply.code(403).send({ error: "edit window expired" });
      }
    }

    const updated = await app.prisma.comment.update({
      where: { id: comment.id },
      data: {
        text: parsed.data.text,
        isEdited: true,
        editedAt: new Date()
      }
    });

    await app.prisma.commentEditHistory.create({
      data: {
        commentId: comment.id,
        editorUserId: userId,
        oldText: comment.text,
        newText: parsed.data.text,
        editedByRole: "user"
      }
    });

    return updated;
  });

  app.delete("/api/comments/:commentId", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "x-user-id header is required" });
    }
    if (!env.USER_CAN_DELETE_OWN_COMMENT) {
      return reply.code(403).send({ error: "deleting own comments disabled" });
    }

    const { commentId } = request.params as { commentId: string };
    const comment = await app.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.status === "deleted") {
      return reply.code(404).send({ error: "comment not found" });
    }
    if (!isRegularComment(comment.kind)) {
      return reply.code(403).send({ error: "system comments cannot be deleted" });
    }
    if (comment.authorId !== userId) {
      return reply.code(403).send({ error: "can delete only own comments" });
    }

    const deleted = await app.prisma.comment.update({
      where: { id: comment.id },
      data: {
        status: "deleted",
        deletedAt: new Date()
      }
    });

    await resolveOpenReportsForComment(app.prisma, comment.id, "resolved_delete");
    await syncPostCommentsCount(app, deleted.postId);
    return { ok: true };
  });

  app.post("/api/comments/:commentId/report", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "x-user-id header is required" });
    }
    const { commentId } = request.params as { commentId: string };
    const parsed = reportBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid request body" });
    }

    const comment = await app.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        author: { select: { maxUserId: true, firstName: true, lastName: true, username: true } },
        post: { include: { chat: { select: { maxChatId: true, title: true } } } }
      }
    });
    if (!comment || comment.status === "deleted") {
      return reply.code(404).send({ error: "comment not found" });
    }
    if (!isRegularComment(comment.kind)) {
      return reply.code(403).send({ error: "system comments cannot be reported" });
    }

    const existing = await app.prisma.commentReport.findUnique({
      where: {
        commentId_reporterUserId: {
          commentId: comment.id,
          reporterUserId: userId
        }
      }
    });
    if (existing) {
      const openReportsCount = await app.prisma.commentReport.count({
        where: { commentId: comment.id, status: "open" }
      });
      return reply.send({ ok: true, duplicate: true, openReportsCount, reportId: existing.id });
    }

    const openBefore = await app.prisma.commentReport.count({
      where: { commentId: comment.id, status: "open" }
    });

    const created = await app.prisma.commentReport.create({
      data: {
        commentId: comment.id,
        reporterUserId: userId,
        status: "open",
        reason: parsed.data.reason?.trim() || null
      }
    });

    const openReportsCount = openBefore + 1;

    if (openBefore === 0) {
      const authorParts = [comment.author.firstName, comment.author.lastName].filter(Boolean) as string[];
      const authorDisplay =
        authorParts.join(" ").trim() || comment.author.username?.trim() || comment.author.maxUserId;
      await sendModerationChatReportNotification(app, {
        reportId: created.id,
        commentId: comment.id,
        postId: comment.postId,
        channelTitle: comment.post.chat.title,
        channelMaxChatId: comment.post.chat.maxChatId,
        postMaxMessageId: comment.post.maxMessageId,
        authorDisplay,
        authorMaxUserId: comment.author.maxUserId,
        commentPreview: comment.text,
        openReportsCount
      });
    }

    return reply.code(201).send({ ok: true, duplicate: false, openReportsCount, reportId: created.id });
  });
};
