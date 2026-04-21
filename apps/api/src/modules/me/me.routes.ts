import type { FastifyPluginAsync } from "fastify";

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/me/role", async (request, reply) => {
    if (!request.platformUser) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    return { role: request.platformUser.isModerator ? "moderator" : "user" };
  });
};
