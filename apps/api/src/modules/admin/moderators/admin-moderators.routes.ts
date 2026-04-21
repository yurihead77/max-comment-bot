import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ensureRole } from "../admin-authz";

const assignSchema = z.object({
  platformUserId: z.string().min(1)
});

export const adminModeratorsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    if (!ensureRole(request, reply, ["admin"])) {
      return;
    }
  });

  app.get("/api/admin/moderators", async () => {
    const items = await app.prisma.moderator.findMany({
      include: {
        user: {
          select: {
            id: true,
            maxUserId: true,
            username: true,
            firstName: true,
            lastName: true,
            photoUrl: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return {
      items: items.map((item) => ({
        userId: item.userId,
        platformUserId: item.user.maxUserId,
        displayName: [item.user.firstName, item.user.lastName].filter(Boolean).join(" ") || item.user.username || null,
        avatarUrl: item.user.photoUrl,
        createdAt: item.createdAt,
        assignedBy: item.assignedBy
      }))
    };
  });

  app.post("/api/admin/moderators", async (request, reply) => {
    const parsed = assignSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    const user = await app.prisma.user.findUnique({
      where: { maxUserId: parsed.data.platformUserId }
    });
    if (!user) {
      return reply.code(404).send({ error: "platform user not found" });
    }

    const moderator = await app.prisma.moderator.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        assignedBy: request.adminSession!.adminUserId
      }
    });

    await app.prisma.moderationAction.create({
      data: {
        actionType: "assign_moderator",
        targetType: "moderator",
        targetId: moderator.id,
        targetUserId: user.id,
        performedByUserId: request.adminSession!.adminUserId,
        performedByType: "admin",
        metadataJson: {
          platformUserId: user.maxUserId
        }
      }
    });

    return reply.code(201).send({
      userId: user.id,
      platformUserId: user.maxUserId,
      assignedBy: moderator.assignedBy,
      createdAt: moderator.createdAt
    });
  });

  app.delete("/api/admin/moderators/:platformUserId", async (request, reply) => {
    const { platformUserId } = request.params as { platformUserId: string };
    const user = await app.prisma.user.findUnique({
      where: { maxUserId: platformUserId }
    });
    if (!user) {
      return reply.code(404).send({ error: "platform user not found" });
    }
    const existing = await app.prisma.moderator.findUnique({
      where: { userId: user.id }
    });
    if (!existing) {
      return reply.code(404).send({ error: "moderator not found" });
    }
    await app.prisma.moderator.delete({
      where: { userId: user.id }
    });

    await app.prisma.moderationAction.create({
      data: {
        actionType: "revoke_moderator",
        targetType: "moderator",
        targetId: existing.id,
        targetUserId: user.id,
        performedByUserId: request.adminSession!.adminUserId,
        performedByType: "admin",
        metadataJson: {
          platformUserId: user.maxUserId
        }
      }
    });

    return reply.send({ ok: true });
  });
};
