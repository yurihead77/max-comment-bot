import type { FastifyInstance } from "fastify";

export async function enqueueSyncJob(app: FastifyInstance, postId: string, error?: string) {
  await app.prisma.syncJob.create({
    data: {
      postId,
      status: error ? "failed" : "pending",
      error: error ?? null
    }
  });
}
