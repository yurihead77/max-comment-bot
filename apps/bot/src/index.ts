import dotenv from "dotenv";
import Fastify from "fastify";
import { z } from "zod";
import { runDevPolling } from "./dev-polling";
import { MaxApiError, MaxClient } from "./max-client";

function redactBotTokenInUrl(url: string, token: string): string {
  if (!token || !url.includes(token)) return url;
  return url.split(token).join("***");
}
import { PostPublisherService } from "./post-publisher.service";
import { webhookRoutes } from "./webhook.routes";

dotenv.config();

const envSchema = z.object({
  BOT_PORT: z.coerce.number().default(3002),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MAX_BOT_TOKEN: z.string().min(1),
  MAX_API_BASE_URL: z.string().url(),
  /** Query param `v` on every MAX platform request (see dev.max.ru / official Go client). */
  MAX_API_VERSION: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : "1.2.5")),
  MAX_WEBAPP_URL: z.string().url(),
  API_PORT: z.coerce.number().default(3001),
  /** Base URL the bot uses to call API (register, sync is triggered from API → bot). Same host default; set in Docker/prod. */
  API_INTERNAL_BASE_URL: z.string().url().optional(),
  /** Must match `secret` from MAX POST /subscriptions; validated via header X-Max-Bot-Api-Secret */
  MAX_WEBHOOK_SECRET: z.string().optional(),
  BOT_MOCK_MAX_API: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1")
    .default("false")
});

const env = envSchema.parse(process.env);

if (env.NODE_ENV === "production" && env.BOT_MOCK_MAX_API) {
  throw new Error("BOT_MOCK_MAX_API cannot be enabled in production");
}

const apiBaseUrl = env.API_INTERNAL_BASE_URL ?? `http://127.0.0.1:${env.API_PORT}`;

async function bootstrap() {
  const app = Fastify({ logger: true });
  const maxClient = new MaxClient(env.MAX_BOT_TOKEN, env.MAX_API_BASE_URL, env.MAX_WEBAPP_URL, {
    apiVersion: env.MAX_API_VERSION
  });
  const postPublisher = new PostPublisherService(maxClient, apiBaseUrl);

  app.get("/healthz", async () => ({ ok: true }));

  await app.register(webhookRoutes, {
    apiBaseUrl,
    maxWebhookSecret: env.MAX_WEBHOOK_SECRET && env.MAX_WEBHOOK_SECRET.length > 0 ? env.MAX_WEBHOOK_SECRET : undefined
  });

  app.post("/internal/sync-button", async (request, reply) => {
    const body = request.body as {
      postId: string;
      chatId: string;
      messageId: string;
      buttonText: string;
    };

    const mid = typeof body.messageId === "string" ? body.messageId.trim() : "";
    if (!mid) {
      app.log.warn({ postId: body.postId }, "internal sync-button rejected: empty messageId (register must store MAX message.body.mid)");
      return reply.code(400).send({ ok: false, error: "empty messageId" });
    }

    if (env.BOT_MOCK_MAX_API && env.NODE_ENV === "development") {
      app.log.info({ postId: body.postId }, "BOT_MOCK_MAX_API: skip real MAX PUT /messages");
      return reply.send({ ok: true, mocked: true });
    }

    const startParam = `post_${body.postId}`;
    const maxApiTargetUrl = maxClient.putMessagesUrl(mid);

    app.log.info(
      {
        route: "/internal/sync-button",
        postId: body.postId,
        chatId: body.chatId,
        messageId: mid,
        buttonText: body.buttonText,
        startParam,
        maxApiMethod: "PUT /messages",
        maxApiUrlRedacted: redactBotTokenInUrl(maxApiTargetUrl, env.MAX_BOT_TOKEN),
        maxApiBaseUrl: env.MAX_API_BASE_URL,
        maxApiVersion: env.MAX_API_VERSION,
        maxWebappUrl: env.MAX_WEBAPP_URL
      },
      "internal sync-button: calling MAX API (PUT messages — token in Authorization header only)"
    );

    try {
      await maxClient.editDiscussButton({
        chatId: body.chatId,
        messageId: mid,
        buttonText: body.buttonText,
        startParam
      });
      return reply.send({ ok: true });
    } catch (e) {
      if (e instanceof MaxApiError) {
        app.log.error(
          {
            route: "/internal/sync-button",
            postId: body.postId,
            chatId: body.chatId,
            messageId: mid,
            err: e.message,
            maxApiUrlRedacted: redactBotTokenInUrl(e.url, env.MAX_BOT_TOKEN),
            status: e.status,
            contentType: e.contentType,
            bodyPreview: e.bodyPreview
          },
          "MAX PUT /messages failed (non-JSON or HTTP error — use MAX_API_BASE_URL=https://platform-api.max.ru per dev.max.ru)"
        );
        return reply.code(502).send({
          ok: false,
          error: e.message,
          maxApiStatus: e.status,
          contentType: e.contentType,
          bodyPreview: e.bodyPreview
        });
      }
      app.log.error({ err: e, postId: body.postId }, "internal sync-button unexpected error");
      return reply.code(502).send({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/internal/publish", async (request, reply) => {
    const body = request.body as { postId: string; chatId: string; text: string };
    try {
      const result = await postPublisher.publishPost(body);
      request.log.info(
        {
          route: "/internal/publish",
          postId: body.postId,
          chatId: body.chatId,
          maxPutMessageId: result.messageId,
          maxPutMessageIdLen: result.messageId.length
        },
        "internal publish: id from MAX POST /messages (same value register persists for PUT /messages)"
      );
      return reply.send(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      request.log.error({ err: msg, postId: body.postId, chatId: body.chatId }, "internal publish failed");
      return reply.code(502).send({ ok: false, error: msg });
    }
  });

  if (env.NODE_ENV === "development") {
    await runDevPolling();
  }

  await app.listen({ port: env.BOT_PORT, host: "0.0.0.0" });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
