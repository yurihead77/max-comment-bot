import type { FastifyPluginAsync } from "fastify";
import { getActiveRestriction } from "../restrictions/restrictions.service";

export const postsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/posts/:postId", async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const userId = request.headers["x-user-id"] as string | undefined;

    const post = await app.prisma.post.findUnique({
      where: { id: postId },
      include: { chat: true }
    });
    if (!post) {
      return reply.code(404).send({ error: "post not found" });
    }

    let canComment = true;
    let restriction: null | { type: string; endsAt: Date | null } = null;
    if (userId) {
      const active = await getActiveRestriction(app.prisma, userId);
      if (active) {
        canComment = false;
        restriction = {
          type: active.restrictionType,
          endsAt: active.endsAt
        };
      }
    }

    return {
      id: post.id,
      commentsCount: post.commentsCount,
      canComment,
      restriction
    };
  });
};
