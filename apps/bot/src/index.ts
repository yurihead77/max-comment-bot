import dotenv from "dotenv";
import Fastify from "fastify";
import { z } from "zod";
import { runDevPolling } from "./dev-polling";
import { maxBotTokenSha256Prefix } from "./max-bot-token-fingerprint";
import { buildDiscussInlineKeyboardAttachment } from "./max-inline-discuss-keyboard";
import { MaxApiError, MaxClient } from "./max-client";
import { normalizeWebAppUrl } from "./normalize-web-app-url";
import { getInternalAppSettings, isModerationChatId } from "./internal-api-settings";
import { extractMessageIdFromMessagesApiResponse, truncateJson } from "./max-webhook-payload";
import { PostPublisherService } from "./post-publisher.service";
import { webhookRoutes } from "./webhook.routes";

function redactBotTokenInUrl(url: string, token: string): string {
  if (!token || !url.includes(token)) return url;
  return url.split(token).join("***");
}

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
  MAX_WEBAPP_URL: z
    .string()
    .url()
    .transform((s) => normalizeWebAppUrl(s)),
  /** Registered mini app identifier used in open_app.web_app (not URL). */
  MAX_OPEN_APP_ID: z.string().min(1),
  /** Optional bot contact id for open_app buttons. */
  MAX_OPEN_APP_CONTACT_ID: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce.number().int().positive().optional()
  ),
  /**
   * Diagnostic only: `link` uses inline `url` button to the same `MAX_WEBAPP_URL` instead of `open_app`.
   * Does not change webhook/register code paths — only keyboard JSON for publish + sync-button.
   */
  MAX_OPEN_APP_DEBUG_MODE: z
    .string()
    .optional()
    .transform((v) => {
      const t = v?.trim().toLowerCase();
      if (t === "link") return "link" as const;
      return "open_app" as const;
    }),
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

const debugPutMessagesBodySchema = z.object({
  messageId: z.string().min(1),
  buttonType: z.enum(["open_app", "link"]),
  buttonText: z.string().min(1).max(128).optional().default("Debug"),
  startParam: z.string().max(512).optional().default("debug_put"),
  linkUrl: z.string().url().optional()
});

if (env.NODE_ENV === "production" && env.BOT_MOCK_MAX_API) {
  throw new Error("BOT_MOCK_MAX_API cannot be enabled in production");
}

const apiBaseUrl = env.API_INTERNAL_BASE_URL ?? `http://127.0.0.1:${env.API_PORT}`;

async function bootstrap() {
  const app = Fastify({ logger: true });
  const maxClient = new MaxClient(env.MAX_BOT_TOKEN, env.MAX_API_BASE_URL, env.MAX_WEBAPP_URL, {
    apiVersion: env.MAX_API_VERSION,
    discussInlineMode: env.MAX_OPEN_APP_DEBUG_MODE,
    openAppId: env.MAX_OPEN_APP_ID,
    openAppContactId: env.MAX_OPEN_APP_CONTACT_ID,
    logOpenAppPayload: (meta) => {
      app.log.info(meta, "MAX messages: outgoing discuss inline_keyboard (see discussInlineMode / inlineButtonType)");
    }
  });

  app.log.info(
    {
      maxDiscussDiagBootstrap: true,
      maxBotTokenSha256Prefix: maxBotTokenSha256Prefix(env.MAX_BOT_TOKEN),
      maxWebappUrlNormalized: env.MAX_WEBAPP_URL,
      maxOpenAppId: env.MAX_OPEN_APP_ID,
      maxOpenAppContactId: env.MAX_OPEN_APP_CONTACT_ID,
      discussInlineMode: env.MAX_OPEN_APP_DEBUG_MODE,
      inlineButtonType: env.MAX_OPEN_APP_DEBUG_MODE === "link" ? "link" : "open_app",
      openAppWebAppSource: "MAX_OPEN_APP_ID"
    },
    "MAX discuss diagnostics: env snapshot at bot startup"
  );
  const postPublisher = new PostPublisherService(maxClient, apiBaseUrl);

  app.get("/healthz", async () => ({ ok: true }));

  await app.register(webhookRoutes, {
    apiBaseUrl,
    maxWebhookSecret: env.MAX_WEBHOOK_SECRET && env.MAX_WEBHOOK_SECRET.length > 0 ? env.MAX_WEBHOOK_SECRET : undefined,
    maxClient
  });

  app.post("/internal/sync-button", async (request, reply) => {
    const body = request.body as {
      postId: string;
      chatId: string;
      messageId: string;
      buttonText: string;
    };

    const settings = await getInternalAppSettings(apiBaseUrl);
    if (isModerationChatId(settings, body.chatId)) {
      app.log.info({ postId: body.postId, chatId: body.chatId }, "internal sync-button: skipped (moderation chat)");
      return reply.send({ ok: true, skipped: true });
    }

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

    const syncPutPayloadPreview = JSON.stringify({
      attachments: [
        buildDiscussInlineKeyboardAttachment({
          mode: env.MAX_OPEN_APP_DEBUG_MODE,
          openAppWebApp: env.MAX_OPEN_APP_ID,
          openAppContactId: env.MAX_OPEN_APP_CONTACT_ID,
          linkUrl: env.MAX_WEBAPP_URL,
          buttonText: body.buttonText,
          startParam
        })
      ]
    }).slice(0, 16_000);

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
        maxBotTokenSha256Prefix: maxBotTokenSha256Prefix(env.MAX_BOT_TOKEN),
        maxWebappUrlNormalized: env.MAX_WEBAPP_URL,
        maxOpenAppId: env.MAX_OPEN_APP_ID,
        maxOpenAppContactId: env.MAX_OPEN_APP_CONTACT_ID,
        discussInlineMode: env.MAX_OPEN_APP_DEBUG_MODE,
        inlineButtonType: env.MAX_OPEN_APP_DEBUG_MODE === "link" ? "link" : "open_app",
        openAppWebAppUsed: env.MAX_OPEN_APP_ID,
        openAppWebAppSource: "MAX_OPEN_APP_ID",
        putRequestPayloadPreview: syncPutPayloadPreview,
        maxWebappHost: (() => {
          try {
            return new URL(env.MAX_WEBAPP_URL).host;
          } catch {
            return undefined;
          }
        })()
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
        const linkNotFound =
          e.status === 404 &&
          (e.bodyPreview.includes("Link not found") || e.bodyPreview.includes("not.found"));
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
            bodyPreview: e.bodyPreview,
            maxBotTokenSha256Prefix: maxBotTokenSha256Prefix(env.MAX_BOT_TOKEN),
            maxWebappUrlNormalized: env.MAX_WEBAPP_URL,
            maxOpenAppId: env.MAX_OPEN_APP_ID,
            maxOpenAppContactId: env.MAX_OPEN_APP_CONTACT_ID,
            discussInlineMode: env.MAX_OPEN_APP_DEBUG_MODE,
            inlineButtonType: env.MAX_OPEN_APP_DEBUG_MODE === "link" ? "link" : "open_app",
            openAppWebAppUsed: env.MAX_OPEN_APP_ID,
            openAppWebAppSource: "MAX_OPEN_APP_ID",
            putRequestPayloadPreview: syncPutPayloadPreview,
            ...(linkNotFound
              ? {
                  maxWebappUrlUsed: env.MAX_WEBAPP_URL,
                  hint:
                    env.MAX_OPEN_APP_DEBUG_MODE === "link"
                      ? "404 with type=link — not the open_app mini app registry path; see docs/max-open-app-debug.md."
                      : "MAX looks up `web_app` against the mini app id/link registered for the bot; check MAX_OPEN_APP_ID first. See docs/max-integration-manual.md and docs/max-open-app-debug.md."
                }
              : {})
          },
          linkNotFound
            ? env.MAX_OPEN_APP_DEBUG_MODE === "link"
              ? "MAX PUT /messages: 404 with link button (unexpected for link-only; check message_id/token)"
              : "MAX PUT /messages: Link not found for open_app.web_app (check MAX_OPEN_APP_ID vs MAX developer UI)"
            : "MAX PUT /messages failed (non-JSON or HTTP error — use MAX_API_BASE_URL=https://platform-api.max.ru per dev.max.ru)"
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

  app.post("/internal/debug/put-messages-button", async (request, reply) => {
    const parsed = debugPutMessagesBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: parsed.error.flatten() });
    }
    const d = parsed.data;
    const mid = d.messageId.trim();

    if (env.BOT_MOCK_MAX_API && env.NODE_ENV === "development") {
      request.log.info(
        { route: "/internal/debug/put-messages-button", mocked: true, messageId: mid, buttonType: d.buttonType },
        "BOT_MOCK_MAX_API: skip real MAX debug PUT /messages"
      );
      return reply.send({ ok: true, mocked: true, messageId: mid, buttonType: d.buttonType });
    }

    const linkTarget = d.linkUrl ? normalizeWebAppUrl(d.linkUrl) : env.MAX_WEBAPP_URL;
    const targetUrl = d.buttonType === "link" ? linkTarget : env.MAX_OPEN_APP_ID;

    const requestBody = {
      attachments: [
        buildDiscussInlineKeyboardAttachment({
          mode: d.buttonType,
          openAppWebApp: env.MAX_OPEN_APP_ID,
          openAppContactId: env.MAX_OPEN_APP_CONTACT_ID,
          linkUrl: targetUrl,
          buttonText: d.buttonText,
          startParam: d.startParam
        })
      ]
    };
    const requestPayloadPreview = JSON.stringify(requestBody).slice(0, 16_000);

    request.log.info(
      {
        route: "/internal/debug/put-messages-button",
        maxBotTokenSha256Prefix: maxBotTokenSha256Prefix(env.MAX_BOT_TOKEN),
        maxWebappUrlNormalized: env.MAX_WEBAPP_URL,
        maxOpenAppId: env.MAX_OPEN_APP_ID,
        maxOpenAppContactId: env.MAX_OPEN_APP_CONTACT_ID,
        envDiscussInlineMode: env.MAX_OPEN_APP_DEBUG_MODE,
        requestButtonType: d.buttonType,
        openAppWebAppSource: "MAX_OPEN_APP_ID",
        openAppWebAppUsed: d.buttonType === "open_app" ? env.MAX_OPEN_APP_ID : undefined,
        messageId: mid,
        putRequestPayloadPreview: requestPayloadPreview,
        maxApiUrlRedacted: redactBotTokenInUrl(maxClient.putMessagesUrl(mid), env.MAX_BOT_TOKEN)
      },
      "internal debug put-messages-button: before MAX PUT /messages"
    );

    const result = await maxClient.debugPutMessagesSingleButton({
      messageId: mid,
      mode: d.buttonType,
      buttonText: d.buttonText,
      startParam: d.startParam,
      linkTargetUrl: d.buttonType === "link" ? linkTarget : undefined
    });

    request.log.info(
      {
        route: "/internal/debug/put-messages-button",
        messageId: mid,
        requestButtonType: d.buttonType,
        httpOk: result.httpOk,
        maxApiStatus: result.status,
        maxSuccessFalseMessage: result.maxSuccessFalseMessage,
        responseBodyPreview: result.responseBodyPreview.slice(0, 16_000),
        maxApiUrlRedacted: redactBotTokenInUrl(result.url, env.MAX_BOT_TOKEN)
      },
      "internal debug put-messages-button: after MAX PUT /messages"
    );

    const success = result.httpOk && result.maxSuccessFalseMessage === undefined;

    return reply.send({
      ok: success,
      messageId: mid,
      buttonType: d.buttonType,
      maxApiStatus: result.status,
      httpOk: result.httpOk,
      maxSuccessFalseMessage: result.maxSuccessFalseMessage,
      requestPayloadPreview,
      responseBodyPreview: result.responseBodyPreview.slice(0, 16_000),
      maxApiUrlRedacted: redactBotTokenInUrl(result.url, env.MAX_BOT_TOKEN)
    });
  });

  app.post("/internal/publish", async (request, reply) => {
    const body = request.body as { postId: string; chatId: string; text: string };
    try {
      const settings = await getInternalAppSettings(apiBaseUrl);
      if (isModerationChatId(settings, body.chatId)) {
        if (env.BOT_MOCK_MAX_API && env.NODE_ENV === "development") {
          app.log.info({ route: "/internal/publish", chatId: body.chatId }, "BOT_MOCK_MAX_API: skip plain send");
          return reply.send({ messageId: "mock", moderationChatPlainMessage: true });
        }
        const published = (await maxClient.sendPlainText({
          chatId: body.chatId,
          text: body.text
        })) as Record<string, unknown>;
        const messageId = extractMessageIdFromMessagesApiResponse(published) ?? "";
        if (!messageId) {
          throw new Error(
            `sendPlainText: no message id in MAX POST /messages response: ${truncateJson(published, 2500)}`
          );
        }
        request.log.info(
          { route: "/internal/publish", chatId: body.chatId, maxPutMessageId: messageId },
          "internal publish: moderation chat — plain text only (no register / discuss buttons)"
        );
        return reply.send({ messageId, moderationChatPlainMessage: true });
      }

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

  app.post("/internal/send-plain-message", async (request, reply) => {
    const body = request.body as {
      chatId?: string;
      text?: string;
      openAppButton?: { text?: string; startParam?: string };
      moderationCard?: { reportId?: string };
    };
    const chatId = typeof body.chatId === "string" ? body.chatId.trim() : "";
    const text = typeof body.text === "string" ? body.text : "";
    if (!chatId || !text) {
      return reply.code(400).send({ ok: false, error: "chatId and text required" });
    }
    const btn = body.openAppButton;
    const buttonText = typeof btn?.text === "string" ? btn.text.trim() : "";
    const startParam = typeof btn?.startParam === "string" ? btn.startParam.trim() : "";
    const withOpenApp = Boolean(buttonText && startParam);
    const reportId = typeof body.moderationCard?.reportId === "string" ? body.moderationCard.reportId.trim() : "";
    const withModerationCard = Boolean(reportId);
    try {
      if (env.BOT_MOCK_MAX_API && env.NODE_ENV === "development") {
        app.log.info(
          { route: "/internal/send-plain-message", chatId, textLen: text.length, withOpenApp, withModerationCard },
          "BOT_MOCK_MAX_API: skip plain send"
        );
        return reply.send({ ok: true, mocked: true });
      }
      if (withModerationCard) {
        const sent = (await maxClient.sendMessage({
          chatId,
          text,
          attachments: [maxClient.openAppOnlyKeyboardAttachment("Открыть жалобу", `report_${reportId}`)]
        })) as Record<string, unknown>;
        const messageId = extractMessageIdFromMessagesApiResponse(sent) ?? "";
        return reply.send({ ok: true, messageId });
      }
      if (withOpenApp) {
        await maxClient.publishPost({ chatId, text, buttonText, startParam });
      } else {
        await maxClient.sendPlainText({ chatId, text });
      }
      return reply.send({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      app.log.error({ err: msg, chatId }, "internal send-plain-message failed");
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
