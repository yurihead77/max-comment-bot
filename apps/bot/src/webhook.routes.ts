import type { FastifyPluginAsync } from "fastify";
import {
  extractChatIdFromMessage,
  extractMessageIdFromMessage,
  extractMessageText,
  extractSenderUserId,
  headersToLogObject,
  isMaxWebhookSecretHeaderPresent,
  parseMaxUpdate,
  truncateJson,
  verifyWebhookSecret
} from "./max-webhook-payload";

export interface WebhookRoutesOpts {
  apiBaseUrl: string;
  maxWebhookSecret?: string;
}

async function postInternalRegister(
  apiBaseUrl: string,
  body: { chatId: string; messageId: string; botMessageText?: string },
  log: { info: (o: object, m?: string) => void; warn: (o: object, m?: string) => void; error: (o: object, m?: string) => void }
): Promise<{ id?: string; error?: string }> {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const url = `${base}/api/internal/posts/register`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chatId: body.chatId,
        messageId: body.messageId,
        botMessageText: body.botMessageText
      })
    });
    const text = await res.text();
    let json: { id?: string } = {};
    try {
      json = text ? (JSON.parse(text) as { id?: string }) : {};
    } catch {
      log.warn({ url, status: res.status, textPreview: text.slice(0, 400) }, "register response is not JSON");
    }
    if (!res.ok) {
      log.error({ url, status: res.status, bodyPreview: text.slice(0, 2000) }, "internal POST /api/internal/posts/register failed");
      return { error: `register HTTP ${res.status}` };
    }
    if (!json.id) {
      log.error({ url, responsePreview: text.slice(0, 500) }, "register response missing id");
      return { error: "missing id in register response" };
    }
    return { id: json.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error({ err: message, url }, "internal register fetch threw");
    return { error: message };
  }
}

async function postInternalSyncButton(
  apiBaseUrl: string,
  postId: string,
  log: { error: (o: object, m?: string) => void }
): Promise<boolean> {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const url = `${base}/api/internal/posts/${encodeURIComponent(postId)}/sync-button`;
  try {
    const res = await fetch(url, { method: "POST" });
    const text = await res.text();
    if (!res.ok) {
      log.error({ url, status: res.status, bodyPreview: text.slice(0, 2000) }, "internal POST sync-button failed");
      return false;
    }
    return true;
  } catch (e) {
    log.error({ err: e instanceof Error ? e.message : String(e), url }, "sync-button fetch threw");
    return false;
  }
}

export const webhookRoutes: FastifyPluginAsync<WebhookRoutesOpts> = async (app, opts) => {
  const { apiBaseUrl, maxWebhookSecret } = opts;

  app.post("/webhook/max", async (request, reply) => {
    const hdr = headersToLogObject(request.headers as Record<string, string | string[] | undefined>);
    const secretCheck = verifyWebhookSecret(request.headers as Record<string, string | string[] | undefined>, maxWebhookSecret);
    if (secretCheck === "invalid") {
      request.log.warn(
        {
          webhook: "secret_rejected",
          xMaxBotApiSecretHeaderPresent: isMaxWebhookSecretHeaderPresent(
            request.headers as Record<string, string | string[] | undefined>
          ),
          maxWebhookSecretConfigured: Boolean(maxWebhookSecret && maxWebhookSecret.length > 0),
          headers: hdr
        },
        "webhook rejected: X-Max-Bot-Api-Secret missing or mismatch vs MAX_WEBHOOK_SECRET"
      );
      return reply.code(401).send({ error: "invalid webhook secret" });
    }

    let body: Record<string, unknown>;
    try {
      if (request.body === undefined || request.body === null) {
        body = {};
      } else if (typeof request.body === "object" && !Array.isArray(request.body)) {
        body = request.body as Record<string, unknown>;
      } else if (typeof request.body === "string") {
        body = (request.body.length === 0 ? {} : JSON.parse(request.body)) as Record<string, unknown>;
      } else {
        body = JSON.parse(String(request.body)) as Record<string, unknown>;
      }
    } catch {
      request.log.warn({ headers: hdr }, "webhook rejected: body is not JSON object");
      return reply.code(400).send({ error: "invalid json" });
    }

    const parsed = parseMaxUpdate(body);
    const messageKeys =
      parsed.kind === "message_created" ? Object.keys(parsed.message) : [];

    const briefIds =
      parsed.kind === "message_created"
        ? {
            chatId: extractChatIdFromMessage(parsed.message),
            maxPutMessageId: extractMessageIdFromMessage(parsed.message)
          }
        : {};

    request.log.info(
      {
        webhook: "max_platform_delivery",
        maxWebhookSecretCheck: secretCheck,
        updateType: parsed.updateType,
        eventKind: parsed.kind,
        userAgent: typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : undefined,
        ...briefIds
      },
      "MAX webhook: HTTPS POST accepted (payload follows in ingress log)"
    );

    request.log.info(
      {
        webhook: "ingress",
        headers: hdr,
        bodyPreview: truncateJson(body, 16_000),
        updateType: parsed.updateType,
        eventKind: parsed.kind,
        messageTopLevelKeys: messageKeys
      },
      "MAX webhook received (full body preview)"
    );

    if (parsed.kind === "bot_started") {
      const user = parsed.raw.user;
      const chatId = parsed.raw.chat_id ?? parsed.raw.chatId;
      request.log.info(
        {
          webhook: "bot_started",
          chatId: chatId != null ? String(chatId) : undefined,
          user: user && typeof user === "object" ? truncateJson(user, 2000) : undefined,
          payload: parsed.raw.payload != null ? truncateJson(parsed.raw.payload, 500) : undefined
        },
        "MAX bot_started (user opened bot / payload); no post registration"
      );
      return reply.send({ ok: true, handled: "bot_started" });
    }

    if (parsed.kind === "message_created") {
      const chatId = extractChatIdFromMessage(parsed.message);
      const messageId = extractMessageIdFromMessage(parsed.message);
      const text = extractMessageText(parsed.message);
      const senderUserId = extractSenderUserId(parsed.message);

      request.log.info(
        {
          webhook: "message_created_extracted",
          updateType: parsed.updateType,
          chatId,
          /** Same string later sent as `message_id` on MAX `PUT /messages` (from `body.mid` / `mid` / fallbacks). */
          maxPutMessageId: messageId,
          messageIdLen: messageId?.length ?? 0,
          senderUserId,
          textPreview: text ? text.slice(0, 200) : undefined,
          hasUrl: parsed.message.url != null,
          hasStat: parsed.message.stat != null
        },
        "MAX message_created: ids for register + PUT /messages"
      );

      if (!chatId || !messageId) {
        request.log.warn(
          {
            webhook: "message_created_skipped",
            reason: "missing chatId or messageId",
            messageSample: truncateJson(parsed.message, 8000)
          },
          "cannot register post: extend max-webhook-payload extractors after inspecting logs"
        );
        return reply.send({ ok: true, skipped: true, reason: "missing_chat_or_message_id" });
      }

      const reg = await postInternalRegister(
        apiBaseUrl,
        { chatId, messageId, botMessageText: text },
        request.log
      );
      if (reg.error || !reg.id) {
        return reply.code(502).send({ ok: false, error: reg.error ?? "register failed" });
      }

      request.log.info({ postId: reg.id, chatId, maxPutMessageId: messageId }, "internal register ok (maxMessageId persisted)");

      const synced = await postInternalSyncButton(apiBaseUrl, reg.id, request.log);
      if (!synced) {
        request.log.error({ postId: reg.id }, "sync-button failed after register; post exists, use resync when bot/API healthy");
      } else {
        request.log.info({ postId: reg.id }, "sync-button ok (MAX PUT /messages)");
      }

      return reply.send({
        ok: true,
        handled: "message_created",
        postId: reg.id,
        syncButton: synced
      });
    }

    request.log.warn(
      {
        webhook: "unsupported_update",
        updateType: parsed.updateType,
        bodyPreview: truncateJson(parsed.raw, 12_000)
      },
      "MAX webhook update_type not handled by bot (no-op)"
    );
    return reply.send({ ok: true, handled: "ignored", updateType: parsed.updateType });
  });
};
