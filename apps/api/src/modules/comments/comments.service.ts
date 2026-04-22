import type { FastifyInstance } from "fastify";
import { isModerationChat } from "../settings/moderation-chat";

export async function syncPostCommentsCount(app: FastifyInstance, postId: string) {
  const count = await app.prisma.comment.count({
    where: {
      postId,
      kind: "comment",
      status: "active"
    }
  });

  const post = await app.prisma.post.update({
    where: { id: postId },
    data: { commentsCount: count },
    select: { id: true, chat: { select: { maxChatId: true } } }
  });

  if (await isModerationChat(app.prisma, post.chat.maxChatId)) {
    return;
  }

  try {
    await app.inject({
      method: "POST",
      url: `/api/internal/posts/${postId}/sync-button`
    });
  } catch (error) {
    app.log.error({ error, postId }, "sync-button failed");
  }
}
