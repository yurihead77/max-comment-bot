import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { env } from "../../config/env";
import { isModerationChat } from "../settings/moderation-chat";
import { enqueueSyncJob } from "./sync-queue.service";

const registerSchema = z.object({
  postId: z.string().optional(),
  chatId: z.string().min(1),
  messageId: z.string().min(1),
  botMessageText: z.string().optional(),
  chatTitle: z.string().optional()
});

const THREAD_HEADER_SYSTEM_MAX_USER_ID = "system:thread-header";
const THREAD_HEADER_FALLBACK_TEXT = "Пост без текстового описания";
const THREAD_HEADER_MAX_TEXT_LENGTH = 800;

function buildThreadHeaderText(raw: string | null | undefined): string {
  const base = (raw ?? "").trim();
  const normalized = base.length > 0 ? base : THREAD_HEADER_FALLBACK_TEXT;
  if (normalized.length <= THREAD_HEADER_MAX_TEXT_LENGTH) return normalized;
  return `${normalized.slice(0, THREAD_HEADER_MAX_TEXT_LENGTH - 1).trimEnd()}…`;
}

function prismaMeta(e: Prisma.PrismaClientKnownRequestError): Record<string, unknown> {
  return { code: e.code, meta: e.meta ?? undefined, message: e.message };
}

export const internalPostsRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/internal/posts/register", async (request, reply) => {
    try {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid body", details: parsed.error.flatten() });
      }
      const { postId, chatId, messageId, botMessageText, chatTitle } = parsed.data;

      if (await isModerationChat(app.prisma, chatId)) {
        request.log.info({ route: "/api/internal/posts/register", chatId }, "internal register: skipped (moderation chat)");
        return reply.send({ skipped: true });
      }

      request.log.info(
        {
          route: "/api/internal/posts/register",
          chatId,
          messageIdLen: messageId.length,
          hasPostId: Boolean(postId),
          hasBotMessageText: botMessageText !== undefined && botMessageText !== "",
          hasChatTitle: chatTitle !== undefined && chatTitle.trim().length > 0
        },
        "internal register: parsed body, before Prisma"
      );

      const chat = await app.prisma.chat.upsert({
        where: { maxChatId: chatId },
        create: { maxChatId: chatId, type: "group", title: chatTitle?.trim() || null },
        update: chatTitle && chatTitle.trim().length > 0 ? { title: chatTitle.trim() } : {}
      });

      request.log.info({ route: "/api/internal/posts/register", chatDbId: chat.id }, "internal register: chat upsert ok");

      let post: { id: string };
      if (postId) {
        const existing = await app.prisma.post.findUnique({ where: { id: postId } });
        if (!existing) {
          request.log.warn({ postId, chatId }, "internal register: postId not found, returning 404");
          return reply.code(404).send({ error: "post not found", postId });
        }
        post = await app.prisma.post.update({
          where: { id: postId },
          data: { chatId: chat.id, maxMessageId: messageId, botMessageText: botMessageText ?? null }
        });
      } else {
        post = await app.prisma.post.upsert({
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
      }

      const headerText = buildThreadHeaderText(botMessageText);
      const headerKey = `post:${post.id}`;
      const headerAuthor = (chat.title ?? "").trim() || "Канал";

      const headerResult = await app.prisma.$transaction(async (tx) => {
        const systemUser = await tx.user.upsert({
          where: { maxUserId: THREAD_HEADER_SYSTEM_MAX_USER_ID },
          create: { maxUserId: THREAD_HEADER_SYSTEM_MAX_USER_ID, username: "thread_header" },
          update: {}
        });
        const created = await tx.comment.upsert({
          where: { threadHeaderKey: headerKey },
          create: {
            postId: post.id,
            authorId: systemUser.id,
            kind: "thread_header",
            threadHeaderKey: headerKey,
            systemAuthor: headerAuthor,
            text: headerText,
            status: "active"
          },
          update: {
            text: headerText,
            systemAuthor: headerAuthor,
            status: "active"
          },
          select: { id: true, createdAt: true, updatedAt: true }
        });
        const existed = created.createdAt.getTime() !== created.updatedAt.getTime();
        return { existed };
      });

      request.log.info(
        {
          route: "/api/internal/posts/register",
          postId: post.id,
          threadHeaderCreated: !headerResult.existed,
          threadHeaderAlreadyExisted: headerResult.existed,
          threadHeaderTextLength: headerText.length
        },
        "internal register: thread header upsert result"
      );
      request.log.info({ route: "/api/internal/posts/register", postId: post.id }, "internal register: success");
      return reply.send({ id: post.id });
    } catch (err) {
      const stack = err instanceof Error ? err.stack : undefined;
      request.log.error(
        {
          err,
          stack,
          route: "/api/internal/posts/register",
          bodyPreview:
            request.body && typeof request.body === "object"
              ? JSON.stringify(request.body).slice(0, 2000)
              : String(request.body).slice(0, 500)
        },
        "internal register: unhandled error (returning 500)"
      );
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        return reply.code(500).send({ error: "database_error", prisma: prismaMeta(err) });
      }
      return reply.code(500).send({ error: "internal_error", message: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/internal/posts/:postId/sync-button", async (request, reply) => {
    const { postId } = request.params as { postId: string };
    try {
      const post = await app.prisma.post.findUnique({
        where: { id: postId },
        select: { id: true, commentsCount: true, chat: { select: { maxChatId: true } }, maxMessageId: true }
      });
      if (!post) {
        return reply.code(404).send({ error: "post not found" });
      }

      if (await isModerationChat(app.prisma, post.chat.maxChatId)) {
        request.log.info({ postId, chatId: post.chat.maxChatId }, "sync-button: skipped (moderation chat)");
        return reply.send({ ok: true, skipped: true });
      }

      const buttonText = post.commentsCount > 0 ? `Обсудить (${post.commentsCount})` : "Обсудить";

      request.log.info(
        {
          postId,
          maxChatId: post.chat.maxChatId,
          maxPutMessageId: post.maxMessageId,
          maxPutMessageIdLen: post.maxMessageId.length
        },
        "sync-button: POST bot /internal/sync-button (MAX PUT /messages uses this messageId)"
      );

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
        try {
          await enqueueSyncJob(app, postId, String(error));
        } catch (enqueueErr) {
          app.log.error({ error: enqueueErr, postId }, "enqueueSyncJob failed after sync-button error");
        }
        return reply.code(500).send({ error: "sync failed" });
      }

      return reply.send({ ok: true });
    } catch (err) {
      const stack = err instanceof Error ? err.stack : undefined;
      request.log.error({ err, stack, postId, route: "sync-button" }, "sync-button: unexpected error");
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        return reply.code(500).send({ error: "database_error", prisma: prismaMeta(err) });
      }
      return reply.code(500).send({ error: "internal_error", message: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/internal/posts/:postId/resync", async (request, reply) => {
    const { postId } = request.params as { postId: string };
    try {
      const latestFailed = await app.prisma.syncJob.findFirst({
        where: { postId, status: "failed" },
        orderBy: { createdAt: "desc" }
      });
      if (!latestFailed) {
        return reply.send({ ok: true, message: "nothing to retry" });
      }
      await app.prisma.syncJob.update({
        where: { id: latestFailed.id },
        data: { status: "pending", error: null }
      });
      const injected = await app.inject({
        method: "POST",
        url: `/api/internal/posts/${postId}/sync-button`
      });
      let payload: unknown = {};
      try {
        payload = injected.body ? JSON.parse(injected.body) : {};
      } catch {
        payload = { parseError: true, bodyPreview: injected.body.slice(0, 500) };
      }
      return reply.code(injected.statusCode).send(payload);
    } catch (err) {
      const stack = err instanceof Error ? err.stack : undefined;
      request.log.error({ err, stack, postId, route: "resync" }, "resync: unexpected error");
      return reply.code(500).send({ error: "internal_error", message: err instanceof Error ? err.message : String(err) });
    }
  });
};
