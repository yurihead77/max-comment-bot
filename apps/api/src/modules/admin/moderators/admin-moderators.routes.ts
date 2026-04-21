import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ensureRole } from "../admin-authz";

const assignSchema = z.object({
  userId: z.string().min(1)
});

export const adminModeratorsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    if (!ensureRole(request, reply, ["admin"])) {
      return;
    }
  });

  app.get("/api/admin/moderators", async () => {
    const items = await app.prisma.adminUser.findMany({
      where: { role: "moderator", isActive: true },
      select: { id: true, email: true, role: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" }
    });
    return { items };
  });

  app.post("/api/admin/moderators", async (request, reply) => {
    const parsed = assignSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    const updated = await app.prisma.adminUser.update({
      where: { id: parsed.data.userId },
      data: { role: "moderator" },
      select: { id: true, email: true, role: true, createdAt: true, updatedAt: true }
    });

    await app.prisma.moderationAction.create({
      data: {
        actionType: "assign_moderator",
        targetUserId: updated.id,
        performedByUserId: request.adminSession!.adminUserId
      }
    });

    return reply.code(201).send(updated);
  });

  app.delete("/api/admin/moderators/:userId", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const updated = await app.prisma.adminUser.update({
      where: { id: userId },
      data: { role: "admin" },
      select: { id: true, email: true, role: true, createdAt: true, updatedAt: true }
    });

    await app.prisma.moderationAction.create({
      data: {
        actionType: "revoke_moderator",
        targetUserId: updated.id,
        performedByUserId: request.adminSession!.adminUserId
      }
    });

    return reply.send(updated);
  });
};
