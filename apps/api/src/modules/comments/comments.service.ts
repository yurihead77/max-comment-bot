import type { FastifyInstance } from "fastify";

export async function syncPostCommentsCount(app: FastifyInstance, postId: string) {
  const count = await app.prisma.comment.count({
    where: {
      postId,
      status: "active"
    }
  });

  await app.prisma.post.update({
    where: { id: postId },
    data: { commentsCount: count }
  });

  try {
    await app.inject({
      method: "POST",
      url: `/api/internal/posts/${postId}/sync-button`
    });
  } catch (error) {
    app.log.error({ error, postId }, "sync-button failed");
  }
}
