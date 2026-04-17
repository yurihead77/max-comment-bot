import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const createSchema = z.object({
  userId: z.string().min(1),
  restrictionType: z.enum(["temporary_mute", "permanent_block"]),
  reason: z.string().optional(),
  endsAt: z.string().datetime().optional()
});

const patchSchema = z.object({
  restrictionType: z.enum(["temporary_mute", "permanent_block"]).optional(),
  reason: z.string().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional()
});

export const adminRestrictionsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    if (!request.adminSession) {
      return reply.code(401).send({ error: "unauthorized" });
    }
  });

  app.get("/api/admin/restrictions", async () => {
    const items = await app.prisma.userRestriction.findMany({
      where: { scopeType: "global" },
      include: { user: true },
      orderBy: { createdAt: "desc" }
    });
    return { items };
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
        restrictionType: data.restrictionType,
        reason: data.reason,
        startsAt: new Date(),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        createdByUserId: request.adminSession!.adminUserId
      }
    });
    await app.prisma.moderationAction.create({
      data: {
        actionType: "restriction_create",
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
        ...parsed.data,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : parsed.data.endsAt,
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
    return reply.send(revoked);
  });
};
