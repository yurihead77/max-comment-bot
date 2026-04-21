import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { syncPostCommentsCount } from "../../comments/comments.service";
import { ensureModeratorOrAdmin, getActor } from "../admin-authz";

const patchSchema = z.object({
  action: z.enum(["hide", "unhide", "delete", "restore"]),
  reason: z.string().optional()
});

export const adminCommentsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    if (!ensureModeratorOrAdmin(request, reply)) {
      return;
    }
  });

  app.get("/api/admin/comments", async (request) => {
    const query = request.query as {
      status?: "active" | "hidden" | "deleted";
      postId?: string;
      channelId?: string;
      text?: string;
      authorUserId?: string;
      page?: string;
      pageSize?: string;
    };
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 20), 1), 100);

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.postId ? { postId: query.postId } : {}),
      ...(query.text
        ? {
            text: {
              contains: query.text,
              mode: "insensitive" as const
            }
          }
        : {}),
      ...(query.authorUserId
        ? {
            author: {
              maxUserId: query.authorUserId
            }
          }
        : {}),
      ...(query.channelId
        ? {
            post: {
              chat: {
                maxChatId: query.channelId
              }
            }
          }
        : {})
    };

    const [total, items] = await Promise.all([
      app.prisma.comment.count({ where }),
      app.prisma.comment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: {
              id: true,
              maxUserId: true,
              username: true,
              firstName: true,
              lastName: true,
              photoUrl: true
            }
          },
          post: {
            include: {
              chat: {
                select: { id: true, maxChatId: true, title: true, type: true }
              }
            }
          },
          attachments: true
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / pageSize), 1)
      }
    };
  });

  app.get("/api/admin/channels", async () => {
    const items = await app.prisma.chat.findMany({
      select: { id: true, maxChatId: true, title: true, type: true },
      orderBy: { createdAt: "desc" }
    });
    return { items };
  });

  app.get("/api/admin/comments/:commentId", async (request, reply) => {
    const { commentId } = request.params as { commentId: string };
    const comment = await app.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        author: true,
        post: {
          include: {
            chat: true
          }
        },
        attachments: true,
        editHistory: true
      }
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
      where: {
        id: commentId
      },
      data: {
        status: nextStatus,
        hiddenAt: nextStatus === "hidden" ? now : null,
        deletedAt: nextStatus === "deleted" ? now : null
      }
    });

    const actor = getActor(request);
    await app.prisma.moderationAction.create({
      data: {
        actionType: `comment_${parsed.data.action}`,
        targetType: "comment",
        targetId: commentId,
        targetCommentId: commentId,
        targetPostId: existing.postId,
        performedByUserId: actor.actorId,
        performedByType: actor.actorType,
        reason: parsed.data.reason ?? null,
        metadataJson: {
          postId: existing.postId
        }
      }
    });

    await syncPostCommentsCount(app, existing.postId);
    return updated;
  });

  app.post("/api/moderation/comments/:commentId/:action", async (request, reply) => {
    if (!ensureModeratorOrAdmin(request, reply)) {
      return;
    }
    const { commentId, action } = request.params as { commentId: string; action: "hide" | "delete" | "restore" };
    const existing = await app.prisma.comment.findUnique({ where: { id: commentId } });
    if (!existing) {
      return reply.code(404).send({ error: "not found" });
    }
    const now = new Date();
    const nextStatus = action === "hide" ? "hidden" : action === "delete" ? "deleted" : "active";
    const updated = await app.prisma.comment.update({
      where: { id: commentId },
      data: {
        status: nextStatus,
        hiddenAt: nextStatus === "hidden" ? now : null,
        deletedAt: nextStatus === "deleted" ? now : null
      }
    });
    const actor = getActor(request);
    await app.prisma.moderationAction.create({
      data: {
        actionType: `comment_${action}`,
        targetType: "comment",
        targetId: commentId,
        targetCommentId: commentId,
        targetPostId: existing.postId,
        performedByUserId: actor.actorId,
        performedByType: actor.actorType
      }
    });
    await syncPostCommentsCount(app, existing.postId);
    return updated;
  });
};
