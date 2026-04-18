import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../../config/env";
import { enqueueSyncJob } from "./sync-queue.service";

const registerSchema = z.object({
  postId: z.string().optional(),
  chatId: z.string().min(1),
  messageId: z.string().min(1),
  botMessageText: z.string().optional()
});

export const internalPostsRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/internal/posts/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }
    const { postId, chatId, messageId, botMessageText } = parsed.data;

    const chat = await app.prisma.chat.upsert({
      where: { maxChatId: chatId },
      create: { maxChatId: chatId, type: "group" },
      update: {}
    });

    const post = postId
      ? await app.prisma.post.update({
          where: { id: postId },
          data: { chatId: chat.id, maxMessageId: messageId, botMessageText }
        })
      : await app.prisma.post.upsert({
          where: {
            chatId_maxMessageId: {
              chatId: chat.id,
              maxMessageId: messageId
            }
          },
          create: {
            chatId: chat.id,
            maxMessageId: messageId,
            botMessageText: botMessageText ?? null
          },
          update: {
            status: "active",
            ...(botMessageText !== undefined && botMessageText !== "" ? { botMessageText } : {})
          }
        });

    return { id: post.id };
  });

  app.post("/api/internal/posts/:postId/sync-button", async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const post = await app.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, commentsCount: true, chat: { select: { maxChatId: true } }, maxMessageId: true }
    });
    if (!post) {
      return reply.code(404).send({ error: "post not found" });
    }

    const buttonText = post.commentsCount > 0 ? `Обсудить (${post.commentsCount})` : "Обсудить";

    try {
      const res = await fetch(`${env.BOT_INTERNAL_BASE_URL}/internal/sync-button`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          postId,
          chatId: post.chat.maxChatId,
          messageId: post.maxMessageId,
          buttonText
        })
      });
      if (!res.ok) {
        const bodyText = await res.text();
        throw new Error(`bot HTTP ${res.status}: ${bodyText}`);
      }
    } catch (error) {
      app.log.error({ error, postId }, "failed to sync button in bot");
      await enqueueSyncJob(app, postId, String(error));
      return reply.code(500).send({ error: "sync failed" });
    }

    return { ok: true };
  });

  app.post("/api/internal/posts/:postId/resync", async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const latestFailed = await app.prisma.syncJob.findFirst({
      where: { postId, status: "failed" },
      orderBy: { createdAt: "desc" }
    });
    if (!latestFailed) {
      return { ok: true, message: "nothing to retry" };
    }
    await app.prisma.syncJob.update({
      where: { id: latestFailed.id },
      data: { status: "pending", error: null }
    });
    return app.inject({
      method: "POST",
      url: `/api/internal/posts/${postId}/sync-button`
    });
  });
};
