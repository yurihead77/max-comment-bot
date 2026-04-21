import type { FastifyPluginAsync } from "fastify";
import { ensureModeratorOrAdmin } from "../admin/admin-authz";
import { resolveOpenReportsForComment } from "../admin/moderation/comment-reports.service";
import { ensureCanModerateTargetUser, getCanModerateTargetUser } from "../admin/moderation/moderation-policy";

function authorDisplay(
  author: { firstName: string | null; lastName: string | null; username: string | null; maxUserId: string }
): string {
  const parts = [author.firstName, author.lastName].filter(Boolean) as string[];
  if (parts.length) return parts.join(" ").trim();
  if (author.username?.trim()) return author.username.trim().startsWith("@")
    ? author.username.trim()
    : `@${author.username.trim()}`;
  return author.maxUserId;
}

export const moderationReportsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/moderation/reports/:reportId/context", async (request, reply) => {
    if (!ensureModeratorOrAdmin(request, reply)) {
      return;
    }
    const { reportId } = request.params as { reportId: string };
    const report = await app.prisma.commentReport.findUnique({
      where: { id: reportId },
      include: {
        comment: {
          include: {
            author: {
              select: {
                id: true,
                maxUserId: true,
                username: true,
                firstName: true,
                lastName: true
              }
            },
            post: {
              include: {
                chat: {
                  select: { id: true, maxChatId: true, title: true, type: true }
                }
              }
            }
          }
        }
      }
    });
    if (!report) {
      return reply.code(404).send({ error: "report not found" });
    }

    const comment = report.comment;
    const post = comment.post;
    const chat = post.chat;

    const reportsOpenCount = await app.prisma.commentReport.count({
      where: { commentId: comment.id, status: "open" }
    });

    const { canModerate } = await getCanModerateTargetUser(request, comment.authorId);

    return {
      reportId: report.id,
      reportStatus: report.status,
      postId: post.id,
      commentId: comment.id,
      channelId: chat.id,
      channelMaxChatId: chat.maxChatId,
      reportsOpenCount,
      commentText: comment.text,
      commentStatus: comment.status,
      commentAuthor: {
        userId: comment.author.id,
        displayName: authorDisplay(comment.author),
        maxUserId: comment.author.maxUserId,
        username: comment.author.username,
        firstName: comment.author.firstName,
        lastName: comment.author.lastName
      },
      post: {
        id: post.id,
        maxMessageId: post.maxMessageId,
        botMessageText: post.botMessageText,
        commentsCount: post.commentsCount,
        status: post.status,
        chat: {
          id: chat.id,
          title: chat.title,
          maxChatId: chat.maxChatId,
          type: chat.type
        }
      },
      canModerate
    };
  });

  app.post("/api/moderation/reports/:reportId/resolve-keep", async (request, reply) => {
    if (!ensureModeratorOrAdmin(request, reply)) {
      return;
    }
    const { reportId } = request.params as { reportId: string };
    const report = await app.prisma.commentReport.findUnique({
      where: { id: reportId },
      include: { comment: true }
    });
    if (!report) {
      return reply.code(404).send({ error: "report not found" });
    }

    const policy = await ensureCanModerateTargetUser(request, reply, report.comment.authorId);
    if (!policy.ok) {
      return;
    }

    const updated = await resolveOpenReportsForComment(app.prisma, report.commentId, "resolved_keep");
    return { ok: true, closedReports: updated };
  });
};
