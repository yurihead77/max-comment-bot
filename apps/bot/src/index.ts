import dotenv from "dotenv";
import Fastify from "fastify";
import { z } from "zod";
import { runDevPolling } from "./dev-polling";
import { MaxClient } from "./max-client";
import { PostPublisherService } from "./post-publisher.service";
import { webhookRoutes } from "./webhook.routes";

dotenv.config();

const envSchema = z.object({
  BOT_PORT: z.coerce.number().default(3002),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MAX_BOT_TOKEN: z.string().min(1),
  MAX_API_BASE_URL: z.string().url(),
  MAX_WEBAPP_URL: z.string().url(),
  API_PORT: z.coerce.number().default(3001),
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

const apiBaseUrl = `http://localhost:${env.API_PORT}`;

async function bootstrap() {
  const app = Fastify({ logger: true });
  const maxClient = new MaxClient(env.MAX_BOT_TOKEN, env.MAX_API_BASE_URL, env.MAX_WEBAPP_URL);
  const postPublisher = new PostPublisherService(maxClient, apiBaseUrl);

  await app.register(webhookRoutes);

  app.post("/internal/sync-button", async (request, reply) => {
    const body = request.body as {
      postId: string;
      chatId: string;
      messageId: string;
      buttonText: string;
    };

    if (env.BOT_MOCK_MAX_API && env.NODE_ENV === "development") {
      app.log.info({ postId: body.postId }, "BOT_MOCK_MAX_API: skip real MAX editMessageReplyMarkup");
      return reply.send({ ok: true, mocked: true });
    }

    await maxClient.editDiscussButton({
      chatId: body.chatId,
      messageId: body.messageId,
      buttonText: body.buttonText,
      startParam: `post_${body.postId}`
    });
    return reply.send({ ok: true });
  });

  app.post("/internal/publish", async (request, reply) => {
    const body = request.body as { postId: string; chatId: string; text: string };
    const result = await postPublisher.publishPost(body);
    return reply.send(result);
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
