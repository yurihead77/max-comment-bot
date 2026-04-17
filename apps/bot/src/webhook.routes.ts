import type { FastifyPluginAsync } from "fastify";

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.post("/webhook/max", async (_request, reply) => {
    return reply.send({ ok: true });
  });
};
