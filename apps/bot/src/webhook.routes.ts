import type { FastifyPluginAsync } from "fastify";
import {
  extractChatIdFromMessage,
  extractChatTitleFromMessage,
  extractMessageIdFromMessage,
  extractMessageText,
  extractSenderUserId,
  headersToLogObject,
  isMaxWebhookSecretHeaderPresent,
  parseMaxUpdate,
  truncateJson,
  verifyWebhookSecret
} from "./max-webhook-payload";
import type { MaxClient } from "./max-client";

export interface WebhookRoutesOpts {
  apiBaseUrl: string;
  maxWebhookSecret?: string;
  maxClient: MaxClient;
}

async function postInternalRegister(
  apiBaseUrl: string,
  body: { chatId: string; messageId: string; botMessageText?: string; chatTitle?: string },
  log: { info: (o: object, m?: string) => void; warn: (o: object, m?: string) => void; error: (o: object, m?: string) => void }
): Promise<{ id?: string; error?: string; skipped?: boolean }> {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const url = `${base}/api/internal/posts/register`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chatId: body.chatId,
        messageId: body.messageId,
        botMessageText: body.botMessageText,
        chatTitle: body.chatTitle
      })
    });
    const text = await res.text();
    let json: { id?: string; skipped?: boolean } = {};
    try {
      json = text ? (JSON.parse(text) as { id?: string }) : {};
    } catch {
      log.warn({ url, status: res.status, textPreview: text.slice(0, 400) }, "register response is not JSON");
    }
    if (!res.ok) {
      log.error({ url, status: res.status, bodyPreview: text.slice(0, 2000) }, "internal POST /api/internal/posts/register failed");
      return { error: `register HTTP ${res.status}` };
    }
    if (json && typeof json === "object" && "skipped" in json && (json as { skipped?: boolean }).skipped) {
      return { skipped: true };
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
  const { apiBaseUrl, maxWebhookSecret, maxClient } = opts;

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
      const chatTitle = extractChatTitleFromMessage(parsed.message);
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
        { chatId, messageId, botMessageText: text, chatTitle },
        request.log
      );
      if (reg.skipped) {
        request.log.info({ chatId, maxPutMessageId: messageId }, "message_created: skipped (moderation chat — no post registration)");
        return reply.send({ ok: true, handled: "moderation_chat_skipped", chatId, maxPutMessageId: messageId });
      }
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

    if (parsed.kind === "message_callback") {
      const callbackId = String(parsed.callback.callback_id ?? parsed.callback.callbackId ?? "");
      const cbUserId = String(
        (parsed.callback.user && typeof parsed.callback.user === "object"
          ? (parsed.callback.user as any).user_id ?? (parsed.callback.user as any).userId
          : undefined) ?? ""
      );
      const payload = String(parsed.callback.payload ?? "");
      const chatId = extractChatIdFromMessage(parsed.message);

      request.log.info(
        {
          webhook: "message_callback_extracted",
          chatId,
          callbackId,
          callbackUserId: cbUserId,
          payloadPreview: payload.slice(0, 200)
        },
        "MAX message_callback received"
      );

      if (!callbackId || !cbUserId || !payload) {
        if (callbackId) {
          await maxClient.answerCallback({
            callbackId,
            notification: "Ошибка: неполный callback"
          }).catch(() => {});
        }
        return reply.send({ ok: true, handled: "message_callback_invalid" });
      }

      const m = /^report_action:([^:]+):(delete|keep|mute|block)$/.exec(payload);
      if (!m) {
        await maxClient.answerCallback({ callbackId, notification: "Неизвестное действие" }).catch(() => {});
        return reply.send({ ok: true, handled: "message_callback_unknown_payload" });
      }

      const reportId = m[1]!;
      const action = m[2]! as "delete" | "keep" | "mute" | "block";

      const base = apiBaseUrl.replace(/\/+$/, "");
      const headers = { "content-type": "application/json", "x-max-user-id": cbUserId };

      const ctxUrl = `${base}/api/moderation/reports/${encodeURIComponent(reportId)}/context`;
      let ctx: any;
      try {
        const res = await fetch(ctxUrl, { headers });
        const text = await res.text();
        ctx = text ? JSON.parse(text) : {};
        if (!res.ok) {
          await maxClient.answerCallback({ callbackId, notification: "Forbidden" }).catch(() => {});
          return reply.send({ ok: true, handled: "message_callback_forbidden", status: res.status });
        }
      } catch (e) {
        await maxClient.answerCallback({ callbackId, notification: "Ошибка загрузки контекста" }).catch(() => {});
        return reply.send({ ok: true, handled: "message_callback_ctx_failed" });
      }

      // If already handled -> no-op, keep only Open App
      const alreadyHandled = ctx.reportStatus && ctx.reportStatus !== "open";
      if (alreadyHandled) {
        const text = String(
          ctx?.post?.chat?.title ? `⚠ Жалоба на комментарий\nКанал: ${ctx.post.chat.title}` : "⚠ Жалоба на комментарий"
        );
        await maxClient.answerCallback({
          callbackId,
          notification: "Жалоба уже обработана",
          message: {
            text,
            attachments: [maxClient.openAppOnlyKeyboardAttachment("Открыть жалобу", `report_${reportId}`)]
          }
        }).catch(() => {});
        return reply.send({ ok: true, handled: "message_callback_already_handled" });
      }

      // Execute action via API
      let statusLine = "";
      try {
        if (action === "delete") {
          const url = `${base}/api/moderation/comments/${encodeURIComponent(ctx.commentId)}/delete`;
          const r = await fetch(url, { method: "POST", headers });
          if (!r.ok) throw new Error(`delete HTTP ${r.status}`);
          statusLine = "Статус: удалено";
        } else if (action === "keep") {
          const url = `${base}/api/moderation/reports/${encodeURIComponent(reportId)}/resolve-keep`;
          const r = await fetch(url, { method: "POST", headers });
          if (!r.ok) throw new Error(`keep HTTP ${r.status}`);
          statusLine = "Статус: оставлено";
        } else if (action === "mute") {
          const urlMute = `${base}/api/moderation/users/${encodeURIComponent(ctx.commentAuthor.userId)}/mute`;
          const r1 = await fetch(urlMute, { method: "POST", headers });
          if (!r1.ok) throw new Error(`mute HTTP ${r1.status}`);
          // Minimal rule: mute closes reports as resolved_keep
          const urlKeep = `${base}/api/moderation/reports/${encodeURIComponent(reportId)}/resolve-keep`;
          await fetch(urlKeep, { method: "POST", headers });
          statusLine = "Статус: пользователь замьючен";
        } else if (action === "block") {
          const urlBlock = `${base}/api/moderation/users/${encodeURIComponent(ctx.commentAuthor.userId)}/block`;
          const r1 = await fetch(urlBlock, { method: "POST", headers });
          if (!r1.ok) throw new Error(`block HTTP ${r1.status}`);
          const urlKeep = `${base}/api/moderation/reports/${encodeURIComponent(reportId)}/resolve-keep`;
          await fetch(urlKeep, { method: "POST", headers });
          statusLine = "Статус: пользователь заблокирован";
        }
      } catch (e) {
        request.log.error({ err: e instanceof Error ? e.message : String(e), action, reportId }, "moderation card action failed");
        await maxClient.answerCallback({ callbackId, notification: "Не удалось выполнить действие" }).catch(() => {});
        return reply.send({ ok: true, handled: "message_callback_action_failed" });
      }

      // Build final message text (keep Open App via plain text link in body for safety)
      const lines = [
        "⚠ Жалоба на комментарий",
        ctx.post?.chat?.title ? `Канал: ${ctx.post.chat.title} (${ctx.channelMaxChatId})` : `Канал: ${ctx.channelMaxChatId}`,
        ctx.post?.maxMessageId ? `Пост (MAX message id): ${ctx.post.maxMessageId}` : undefined,
        ctx.commentAuthor?.displayName ? `Автор: ${ctx.commentAuthor.displayName} (MAX user id: ${ctx.commentAuthor.maxUserId})` : undefined,
        ctx.commentText ? `Текст: ${String(ctx.commentText).slice(0, 500)}${String(ctx.commentText).length > 500 ? "…" : ""}` : undefined,
        typeof ctx.reportsOpenCount === "number" ? `Открытых жалоб: ${ctx.reportsOpenCount}` : undefined,
        statusLine
      ].filter(Boolean) as string[];

      await maxClient.answerCallback({
        callbackId,
        notification: "Готово",
        message: {
          text: lines.join("\n"),
          attachments: [maxClient.openAppOnlyKeyboardAttachment("Открыть жалобу", `report_${reportId}`)]
        }
      }).catch(() => {});

      return reply.send({ ok: true, handled: "message_callback_action_ok", action, reportId });
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
