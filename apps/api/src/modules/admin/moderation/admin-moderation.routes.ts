import type { FastifyPluginAsync } from "fastify";

export const adminModerationRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    if (!request.adminSession) {
      return reply.code(401).send({ error: "unauthorized" });
    }
  });

  app.get("/api/admin/moderation-actions", async () => {
    const items = await app.prisma.moderationAction.findMany({
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return { items };
  });
};
