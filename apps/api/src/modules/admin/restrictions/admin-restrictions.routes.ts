import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ensureModeratorOrAdmin, getActor } from "../admin-authz";
import { ensureCanModerateTargetUser } from "../moderation/moderation-policy";

const createSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(["mute", "block"]),
  reason: z.string().optional(),
  expiresAt: z.string().datetime().optional()
});

const patchSchema = z.object({
  type: z.enum(["mute", "block"]).optional(),
  reason: z.string().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  active: z.boolean().optional()
});

export const adminRestrictionsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    if (!ensureModeratorOrAdmin(request, reply)) {
      return;
    }
  });

  app.get("/api/admin/restrictions", async (request) => {
    const query = request.query as { type?: "mute" | "block"; active?: "true" | "false" };
    const items = await app.prisma.userRestriction.findMany({
      where: {
        scopeType: "global",
        ...(query.type
          ? {
              restrictionType: query.type === "mute" ? "temporary_mute" : "permanent_block"
            }
          : {}),
        ...(query.active ? { isActive: query.active === "true" } : {})
      },
      include: { user: true },
      orderBy: { createdAt: "desc" }
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        userId: item.userId,
        type: item.restrictionType === "temporary_mute" ? "mute" : "block",
        active: item.isActive,
        reason: item.reason,
        createdBy: item.createdByUserId,
        createdAt: item.createdAt,
        expiresAt: item.endsAt,
        revokedAt: item.revokedAt,
        revokedBy: item.revokedByUserId,
        user: item.user
      }))
    };
  });

  app.post("/api/admin/restrictions", async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }
    const data = parsed.data;
    const policy = await ensureCanModerateTargetUser(request, reply, data.userId);
    if (!policy.ok) {
      return;
    }
    const actor = getActor(request);
    const row = await app.prisma.userRestriction.create({
      data: {
        userId: data.userId,
        scopeType: "global",
        restrictionType: data.type === "mute" ? "temporary_mute" : "permanent_block",
        reason: data.reason,
        startsAt: new Date(),
        endsAt: data.expiresAt ? new Date(data.expiresAt) : null,
        createdByUserId: actor.actorId
      }
    });
    await app.prisma.moderationAction.create({
      data: {
        actionType: data.type === "mute" ? "mute_user" : "block_user",
        targetType: "user",
        targetId: data.userId,
        targetUserId: data.userId,
        performedByUserId: actor.actorId,
        performedByType: actor.actorType,
        reason: data.reason ?? null,
        payloadJson: row
      }
    });
    return reply.code(201).send(row);
  });

  app.patch("/api/admin/restrictions/:restrictionId", async (request, reply) => {
    const { restrictionId } = request.params as { restrictionId: string };
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }
    const actor = getActor(request);
    const existing = await app.prisma.userRestriction.findUnique({ where: { id: restrictionId } });
    if (!existing) {
      return reply.code(404).send({ error: "not found" });
    }
    const policy = await ensureCanModerateTargetUser(request, reply, existing.userId);
    if (!policy.ok) {
      return;
    }
    const updated = await app.prisma.userRestriction.update({
      where: { id: restrictionId },
      data: {
        restrictionType:
          parsed.data.type === undefined
            ? undefined
            : parsed.data.type === "mute"
              ? "temporary_mute"
              : "permanent_block",
        reason: parsed.data.reason,
        endsAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : parsed.data.expiresAt,
        isActive: parsed.data.active,
        updatedByUserId: actor.actorId
      }
    });
    return updated;
  });

  app.post("/api/admin/restrictions/:restrictionId/revoke", async (request, reply) => {
    const { restrictionId } = request.params as { restrictionId: string };
    const actor = getActor(request);
    const existing = await app.prisma.userRestriction.findUnique({ where: { id: restrictionId } });
    if (!existing) {
      return reply.code(404).send({ error: "not found" });
    }
    const policy = await ensureCanModerateTargetUser(request, reply, existing.userId);
    if (!policy.ok) {
      return;
    }
    const revoked = await app.prisma.userRestriction.update({
      where: { id: restrictionId },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedByUserId: actor.actorId
      }
    });
    await app.prisma.moderationAction.create({
      data: {
        actionType: revoked.restrictionType === "temporary_mute" ? "unmute_user" : "unblock_user",
        targetType: "user",
        targetId: revoked.userId,
        targetUserId: revoked.userId,
        performedByUserId: actor.actorId,
        performedByType: actor.actorType
      }
    });
    return reply.send(revoked);
  });

  app.post("/api/moderation/users/:userId/mute", async (request, reply) => {
    if (!ensureModeratorOrAdmin(request, reply)) {
      return;
    }
    const { userId } = request.params as { userId: string };
    const policy = await ensureCanModerateTargetUser(request, reply, userId);
    if (!policy.ok) {
      return;
    }
    const actor = getActor(request);
    const row = await app.prisma.userRestriction.create({
      data: {
        userId,
        scopeType: "global",
        restrictionType: "temporary_mute",
        startsAt: new Date(),
        createdByUserId: actor.actorId
      }
    });
    await app.prisma.moderationAction.create({
      data: {
        actionType: "mute_user",
        targetType: "user",
        targetId: userId,
        targetUserId: userId,
        performedByUserId: actor.actorId,
        performedByType: actor.actorType,
        payloadJson: row
      }
    });
    return row;
  });

  app.post("/api/moderation/users/:userId/block", async (request, reply) => {
    if (!ensureModeratorOrAdmin(request, reply)) {
      return;
    }
    const { userId } = request.params as { userId: string };
    const policy = await ensureCanModerateTargetUser(request, reply, userId);
    if (!policy.ok) {
      return;
    }
    const actor = getActor(request);
    const row = await app.prisma.userRestriction.create({
      data: {
        userId,
        scopeType: "global",
        restrictionType: "permanent_block",
        startsAt: new Date(),
        createdByUserId: actor.actorId
      }
    });
    await app.prisma.moderationAction.create({
      data: {
        actionType: "block_user",
        targetType: "user",
        targetId: userId,
        targetUserId: userId,
        performedByUserId: actor.actorId,
        performedByType: actor.actorType,
        payloadJson: row
      }
    });
    return row;
  });

  app.post("/api/moderation/users/:userId/unblock", async (request, reply) => {
    if (!ensureModeratorOrAdmin(request, reply)) {
      return;
    }
    const { userId } = request.params as { userId: string };
    const policy = await ensureCanModerateTargetUser(request, reply, userId);
    if (!policy.ok) {
      return;
    }
    const actor = getActor(request);
    await app.prisma.userRestriction.updateMany({
      where: {
        userId,
        isActive: true,
        scopeType: "global",
        restrictionType: "permanent_block"
      },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedByUserId: actor.actorId
      }
    });
    await app.prisma.moderationAction.create({
      data: {
        actionType: "unblock_user",
        targetType: "user",
        targetId: userId,
        targetUserId: userId,
        performedByUserId: actor.actorId,
        performedByType: actor.actorType
      }
    });
    return { ok: true };
  });

  app.get("/api/moderation/users/:userId/state", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, maxUserId: true }
    });
    if (!user) {
      return reply.code(404).send({ error: "user not found" });
    }

    const policy = await ensureCanModerateTargetUser(request, reply, user.id);
    if (!policy.ok) {
      return;
    }

    const now = new Date();
    const active = await app.prisma.userRestriction.findMany({
      where: {
        userId: user.id,
        scopeType: "global",
        isActive: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }]
      },
      orderBy: { createdAt: "desc" }
    });

    const normalized = active.map((item) => ({
      id: item.id,
      type: item.restrictionType === "temporary_mute" ? "mute" : "block",
      createdAt: item.createdAt,
      expiresAt: item.endsAt,
      reason: item.reason
    }));

    return {
      userId: user.id,
      platformUserId: user.maxUserId,
      isMuted: normalized.some((r) => r.type === "mute"),
      isBlocked: normalized.some((r) => r.type === "block"),
      activeRestrictions: normalized
    };
  });
};
