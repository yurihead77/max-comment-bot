import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../../config/env";
import { getActiveRestriction } from "../restrictions/restrictions.service";
import { assertCooldown, assertRateLimit } from "./antispam.service";
import { syncPostCommentsCount } from "./comments.service";

const createBodySchema = z.object({
  text: z.string().trim().min(1).max(env.MAX_COMMENT_LENGTH),
  attachmentIds: z.array(z.string()).max(env.MAX_ATTACHMENTS_PER_COMMENT).default([])
});

const updateBodySchema = z.object({
  text: z.string().trim().min(1).max(env.MAX_COMMENT_LENGTH)
});

function getUserId(request: any) {
  return request.headers["x-user-id"] as string | undefined;
}

export const commentsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/posts/:postId/comments", async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const query = request.query as { cursor?: string; limit?: string };
    const limit = Math.min(Number(query.limit ?? 20), 50);

    const comments = await app.prisma.comment.findMany({
      where: { postId, status: "active" },
      orderBy: { createdAt: "asc" },
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1
          }
        : {}),
      take: limit,
      include: { author: true, attachments: true }
    });

    return { items: comments };
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

    const comment = await app.prisma.comment.create({
      data: {
        postId,
        authorId: userId,
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

    await syncPostCommentsCount(app, deleted.postId);
    return { ok: true };
  });
};
