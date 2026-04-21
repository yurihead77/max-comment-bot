import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ensureRole } from "../admin-authz";

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
    if (!ensureRole(request, reply, ["admin", "moderator"])) {
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
    const row = await app.prisma.userRestriction.create({
      data: {
        userId: data.userId,
        scopeType: "global",
        restrictionType: data.type === "mute" ? "temporary_mute" : "permanent_block",
        reason: data.reason,
        startsAt: new Date(),
        endsAt: data.expiresAt ? new Date(data.expiresAt) : null,
        createdByUserId: request.adminSession!.adminUserId
      }
    });
    await app.prisma.moderationAction.create({
      data: {
        actionType: data.type === "mute" ? "mute_user" : "block_user",
        targetUserId: data.userId,
        performedByUserId: request.adminSession!.adminUserId,
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
        updatedByUserId: request.adminSession!.adminUserId
      }
    });
    return updated;
  });

  app.post("/api/admin/restrictions/:restrictionId/revoke", async (request, reply) => {
    const { restrictionId } = request.params as { restrictionId: string };
    const revoked = await app.prisma.userRestriction.update({
      where: { id: restrictionId },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedByUserId: request.adminSession!.adminUserId
      }
    });
    await app.prisma.moderationAction.create({
      data: {
        actionType: revoked.restrictionType === "temporary_mute" ? "unmute_user" : "unblock_user",
        targetUserId: revoked.userId,
        performedByUserId: request.adminSession!.adminUserId
      }
    });
    return reply.send(revoked);
  });
};
