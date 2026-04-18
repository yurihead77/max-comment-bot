import crypto from "node:crypto";

/** MAX sends this when a `secret` was set on POST /subscriptions (see dev.max.ru docs). */
export const MAX_WEBHOOK_SECRET_HEADER = "x-max-bot-api-secret";

export function headersToLogObject(raw: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue;
    const lower = k.toLowerCase();
    const val = Array.isArray(v) ? v.join(",") : String(v);
    if (lower === MAX_WEBHOOK_SECRET_HEADER && val.length > 0) {
      out[lower] = "[set]";
    } else {
      out[lower] = val;
    }
  }
  return out;
}

export function timingSafeEqualString(expected: string, received: string): boolean {
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(received);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyWebhookSecret(
  headers: Record<string, string | string[] | undefined>,
  configuredSecret: string | undefined
): "ok" | "skip" | "invalid" {
  if (!configuredSecret || configuredSecret.length === 0) return "skip";
  const raw = headers[MAX_WEBHOOK_SECRET_HEADER] ?? headers["X-Max-Bot-Api-Secret"];
  const received = Array.isArray(raw) ? raw[0] : raw;
  if (!received || typeof received !== "string") return "invalid";
  return timingSafeEqualString(configuredSecret, received) ? "ok" : "invalid";
}

function coerceId(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "string" || typeof v === "number" || typeof v === "bigint") return String(v);
  return undefined;
}

/**
 * MAX Update.message (see https://dev.max.ru/docs-api/objects/Message).
 * Webhook payloads may use `message.chat.id`, `recipient.chat_id`, or `body`-nested shapes.
 */
export function extractChatIdFromMessage(message: Record<string, unknown>): string | undefined {
  const directChat = message.chat;
  if (directChat && typeof directChat === "object") {
    const c = directChat as Record<string, unknown>;
    const id = coerceId(c.id ?? c.chat_id ?? c.chatId);
    if (id) return id;
  }

  const topLevelChat = coerceId(message.chat_id ?? message.chatId);
  if (topLevelChat) return topLevelChat;

  const rec = message.recipient;
  if (rec && typeof rec === "object") {
    const r = rec as Record<string, unknown>;
    const nestedChat = r.chat;
    if (nestedChat && typeof nestedChat === "object") {
      const c = nestedChat as Record<string, unknown>;
      const id = coerceId(c.id ?? c.chat_id ?? c.chatId);
      if (id) return id;
    }
    return coerceId(r.chat_id ?? r.chatId ?? r.id ?? r.user_id);
  }

  return undefined;
}

/**
 * Id for MAX `PUT /messages?message_id=…` matches **`Message.body.mid`** (and often `message.mid`).
 * Prefer **`body.mid`** over legacy/Telegram-style **`message_id`** on the same object so a synthetic
 * `message_id` in fixtures cannot shadow the real mid.
 */
export function extractMessageIdFromMessage(message: Record<string, unknown>): string | undefined {
  const body = message.body;
  const bodyMid =
    body && typeof body === "object" ? coerceId((body as Record<string, unknown>).mid) : undefined;
  if (bodyMid) return bodyMid;
  return coerceId(message.mid ?? message.message_id ?? message.messageId ?? message.id);
}

/** Successful **`POST /messages`** body is `{ message: <Message> }` (same `Message` shape as webhooks). */
export function extractMessageIdFromMessagesApiResponse(data: Record<string, unknown>): string | undefined {
  const msg = data.message;
  if (msg && typeof msg === "object") {
    return extractMessageIdFromMessage(msg as Record<string, unknown>);
  }
  return extractMessageIdFromMessage(data);
}

export function extractMessageText(message: Record<string, unknown>): string | undefined {
  const root = message.text ?? message.caption;
  if (typeof root === "string") return root;

  const body = message.body;
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  const direct = b.text ?? b.caption ?? b.message;
  if (typeof direct === "string") return direct;
  if (direct && typeof direct === "object") {
    const t = (direct as Record<string, unknown>).text;
    if (typeof t === "string") return t;
  }
  return undefined;
}

export function extractSenderUserId(message: Record<string, unknown>): string | undefined {
  const sender = message.sender;
  if (!sender || typeof sender !== "object") return undefined;
  return coerceId((sender as Record<string, unknown>).user_id ?? (sender as Record<string, unknown>).userId);
}

export type ParsedMaxUpdate =
  | { kind: "message_created"; updateType: string; timestamp?: number; message: Record<string, unknown> }
  | { kind: "bot_started"; updateType: string; timestamp?: number; raw: Record<string, unknown> }
  | { kind: "unknown"; updateType: string; timestamp?: number; raw: Record<string, unknown> };

export function parseMaxUpdate(body: Record<string, unknown>): ParsedMaxUpdate {
  const updateType =
    body.update_type != null ? String(body.update_type) : body.type != null ? String(body.type) : "unknown";
  const timestamp = typeof body.timestamp === "number" ? body.timestamp : undefined;

  if (updateType === "message_created" && body.message && typeof body.message === "object") {
    return {
      kind: "message_created",
      updateType,
      timestamp,
      message: body.message as Record<string, unknown>
    };
  }

  if (updateType === "bot_started") {
    return { kind: "bot_started", updateType, timestamp, raw: body };
  }

  return { kind: "unknown", updateType, timestamp, raw: body };
}

export function truncateJson(obj: unknown, maxChars: number): string {
  const s = JSON.stringify(obj);
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}…(truncated, ${s.length} chars total)`;
}
