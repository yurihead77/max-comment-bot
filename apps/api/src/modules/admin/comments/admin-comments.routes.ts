import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { syncPostCommentsCount } from "../../comments/comments.service";

const patchSchema = z.object({
  action: z.enum(["hide", "unhide", "delete", "restore"]),
  reason: z.string().optional()
});

export const adminCommentsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    if (!request.adminSession) {
      return reply.code(401).send({ error: "unauthorized" });
    }
  });

  app.get("/api/admin/comments", async (request) => {
    const query = request.query as { status?: "active" | "hidden" | "deleted"; postId?: string };
    const items = await app.prisma.comment.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.postId ? { postId: query.postId } : {})
      },
      orderBy: { createdAt: "desc" },
      include: { author: true, post: true, attachments: true }
    });
    return { items };
  });

  app.get("/api/admin/comments/:commentId", async (request, reply) => {
    const { commentId } = request.params as { commentId: string };
    const comment = await app.prisma.comment.findUnique({
      where: { id: commentId },
      include: { author: true, post: true, attachments: true, editHistory: true }
    });
    if (!comment) {
      return reply.code(404).send({ error: "not found" });
    }
    return comment;
  });

  app.patch("/api/admin/comments/:commentId", async (request, reply) => {
    const { commentId } = request.params as { commentId: string };
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    const existing = await app.prisma.comment.findUnique({ where: { id: commentId } });
    if (!existing) {
      return reply.code(404).send({ error: "not found" });
    }

    const now = new Date();
    const nextStatus =
      parsed.data.action === "hide"
        ? "hidden"
        : parsed.data.action === "unhide" || parsed.data.action === "restore"
          ? "active"
          : "deleted";

    const updated = await app.prisma.comment.update({
      where: { id: commentId },
      data: {
        status: nextStatus,
        hiddenAt: nextStatus === "hidden" ? now : null,
        deletedAt: nextStatus === "deleted" ? now : null
      }
    });

    await app.prisma.moderationAction.create({
      data: {
        actionType: `comment_${parsed.data.action}`,
        targetCommentId: commentId,
        targetPostId: existing.postId,
        performedByUserId: request.adminSession!.adminUserId,
        reason: parsed.data.reason ?? null
      }
    });

    await syncPostCommentsCount(app, existing.postId);
    return updated;
  });
};
