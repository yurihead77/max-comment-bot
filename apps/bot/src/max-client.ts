import { buildDiscussInlineKeyboardAttachment, type MaxDiscussInlineMode } from "./max-inline-discuss-keyboard";

export interface PublishPostPayload {
  chatId: string;
  text: string;
  startParam: string;
  buttonText: string;
}

export interface SyncButtonPayload {
  chatId: string;
  messageId: string;
  buttonText: string;
  startParam: string;
}

export type MaxClientLogOpenAppPayload = (meta: Record<string, unknown>) => void;

export interface MaxClientOptions {
  apiVersion?: string;
  /** Structured log of outgoing discuss inline_keyboard JSON (POST/PUT messages). */
  logOpenAppPayload?: MaxClientLogOpenAppPayload;
  /**
   * Diagnostic: `link` sends a normal URL button to the same `targetUrl` as `open_app.web_app`,
   * to compare MAX behaviour (link registry vs mini app link registry).
   */
  discussInlineMode?: MaxDiscussInlineMode;
  /** Registered mini app identifier for `open_app.web_app` (e.g. bot username / link id). */
  openAppId: string;
  /** Optional contact id for `open_app` buttons. */
  openAppContactId?: number;
}

/** Thrown when MAX HTTP API returns non-JSON, error status, or unreadable body. */
export class MaxApiError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly status: number,
    public readonly contentType: string | null,
    public readonly bodyPreview: string
  ) {
    super(message);
    this.name = "MaxApiError";
  }
}

function normalizeApiBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

async function readMaxJsonResponse(response: Response, url: string): Promise<unknown> {
  const status = response.status;
  const contentType = response.headers.get("content-type");
  const text = await response.text();
  const bodyPreview = text.slice(0, 300);

  const ct = (contentType ?? "").toLowerCase();
  const looksJson = ct.includes("application/json") || ct.includes("text/json");
  const trim = text.trimStart();
  const looksLikeJsonBody = trim.startsWith("{") || trim.startsWith("[");

  if (!response.ok) {
    throw new MaxApiError(
      `MAX API HTTP ${status} (expected JSON body)`,
      url,
      status,
      contentType,
      bodyPreview
    );
  }

  if (!looksJson && !looksLikeJsonBody) {
    throw new MaxApiError(
      `MAX API response is not JSON (content-type: ${contentType ?? "missing"}, body starts with: ${bodyPreview.slice(0, 80)})`,
      url,
      status,
      contentType,
      bodyPreview
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new MaxApiError(
      `MAX API JSON parse failed (content-type: ${contentType ?? "missing"})`,
      url,
      status,
      contentType,
      bodyPreview
    );
  }
}

function assertMaxCommandSuccess(
  data: unknown,
  url: string,
  status: number,
  contentType: string | null,
  bodyPreview: string
): void {
  if (data && typeof data === "object" && "success" in data && (data as { success: unknown }).success === false) {
    const msg = (data as { message?: unknown }).message;
    throw new MaxApiError(`MAX API success=false: ${String(msg ?? "")}`, url, status, contentType, bodyPreview);
  }
}

export type MaxDebugPutResult = {
  url: string;
  httpOk: boolean;
  status: number;
  contentType: string | null;
  /** Truncated raw response body for logs. */
  responseBodyPreview: string;
  parsed?: unknown;
  maxSuccessFalseMessage?: string;
};

/**
 * MAX Bot HTTP API (see https://dev.max.ru/docs-api).
 * Uses `POST /messages` + `PUT /messages?message_id=…` with `Authorization: <token>` and query `v=<api version>`.
 * The legacy Telegram-style `/bot<token>/sendMessage` / `editMessageReplyMarkup` paths are not used on platform-api.max.ru.
 */
export class MaxClient {
  private readonly apiVersion: string;
  private readonly logOpenAppPayload?: MaxClientLogOpenAppPayload;
  private readonly discussInlineMode: MaxDiscussInlineMode;
  private readonly openAppId: string;
  private readonly openAppContactId?: number;

  constructor(
    private readonly token: string,
    /** API origin, e.g. https://platform-api.max.ru (not the mini app site). */
    private readonly baseUrl: string,
    /** URL for link-mode diagnostics and mini app web origin. */
    private readonly webAppUrl: string,
    opts?: MaxClientOptions
  ) {
    this.apiVersion = opts?.apiVersion ?? "1.2.5";
    this.logOpenAppPayload = opts?.logOpenAppPayload;
    this.discussInlineMode = opts?.discussInlineMode ?? "open_app";
    this.openAppId = opts?.openAppId ?? "";
    this.openAppContactId = opts?.openAppContactId;
  }

  /** Diagnostic: POST /messages?chat_id=…&v=… (token only in Authorization header). */
  postMessagesUrl(chatId: string): string {
    return this.buildMessagesUrl({ chat_id: chatId });
  }

  /** Diagnostic: PUT /messages?message_id=…&v=… */
  putMessagesUrl(messageId: string): string {
    return this.buildMessagesUrl({ message_id: messageId });
  }

  /** Diagnostic: POST /answers?callback_id=…&v=… */
  postAnswersUrl(callbackId: string): string {
    const baseRoot = `${normalizeApiBase(this.baseUrl)}/`;
    const u = new URL("answers", baseRoot);
    u.searchParams.set("v", this.apiVersion);
    u.searchParams.set("callback_id", callbackId);
    return u.toString();
  }

  private buildMessagesUrl(query: Record<string, string | undefined>): string {
    const baseRoot = `${normalizeApiBase(this.baseUrl)}/`;
    const u = new URL("messages", baseRoot);
    u.searchParams.set("v", this.apiVersion);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") u.searchParams.set(k, v);
    }
    return u.toString();
  }

  private discussKeyboardAttachment(buttonText: string, startParam: string) {
    return buildDiscussInlineKeyboardAttachment({
      mode: this.discussInlineMode,
      openAppWebApp: this.openAppId,
      openAppContactId: this.openAppContactId,
      linkUrl: this.webAppUrl,
      buttonText,
      startParam
    });
  }

  /** Inline keyboard with a single open_app row (always open_app, even when discussInlineMode=link). */
  openAppOnlyKeyboardAttachment(buttonText: string, startParam: string) {
    return buildDiscussInlineKeyboardAttachment({
      mode: "open_app",
      openAppWebApp: this.openAppId,
      openAppContactId: this.openAppContactId,
      linkUrl: this.webAppUrl,
      buttonText,
      startParam
    });
  }

  private logDiscussOutbound(operation: string, body: unknown, buttonText: string, startParam: string): void {
    if (!this.logOpenAppPayload) return;
    let host: string | undefined;
    try {
      host = new URL(this.webAppUrl).host;
    } catch {
      host = undefined;
    }
    const serialized = JSON.stringify(body);
    const firstBtn = this.discussInlineMode === "open_app" ? "open_app" : "link";
    const openAppWebAppSource = "MAX_OPEN_APP_ID";
    const openAppWebAppValue = this.openAppId;
    this.logOpenAppPayload({
      maxDiscussInlineOutgoing: true,
      operation,
      discussInlineMode: this.discussInlineMode,
      inlineButtonType: firstBtn,
      buttonText,
      startParam,
      webAppUrl: this.webAppUrl,
      webAppHost: host,
      openAppWebAppValue,
      openAppWebAppSource,
      openAppContactId: this.openAppContactId,
      attachmentsJsonPreview: serialized.slice(0, 16_000),
      attachmentsJsonLen: serialized.length
    });
  }

  private async maxJsonFetch(method: "POST" | "PUT", url: string, body: unknown): Promise<unknown> {
    const jsonBody = JSON.stringify(body);
    console.log("=== MAX REQUEST META ===");
    console.log({
      url,
      method
    });
    console.log("=== MAX REQUEST JSON ===");
    console.log(jsonBody);
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: this.token,
        "content-type": "application/json"
      },
      body: jsonBody
    });
    const parsed = await readMaxJsonResponse(response, url);
    const preview = JSON.stringify(parsed).slice(0, 300);
    assertMaxCommandSuccess(parsed, url, response.status, response.headers.get("content-type"), preview);
    return parsed;
  }

  /** Official callback answer (updates message + optional toast). Docs: https://dev.max.ru/docs-api/methods/POST/answers */
  async answerCallback(payload: { callbackId: string; message?: { text?: string; attachments?: unknown[] | null }; notification?: string | null }) {
    const url = this.postAnswersUrl(payload.callbackId);
    const body: Record<string, unknown> = {};
    if (payload.message) {
      body.message = payload.message;
    }
    if (payload.notification !== undefined) {
      body.notification = payload.notification;
    }
    return this.maxJsonFetch("POST", url, body);
  }

  /**
   * PUT /messages with a single-row keyboard for diagnostics.
   * Does not throw on HTTP errors — returns status and body preview for comparison (open_app vs link).
   */
  async debugPutMessagesSingleButton(args: {
    messageId: string;
    mode: MaxDiscussInlineMode;
    buttonText: string;
    startParam: string;
    /** For `link` mode; defaults to `webAppUrl` when omitted. */
    linkTargetUrl?: string;
  }): Promise<MaxDebugPutResult> {
    const url = this.buildMessagesUrl({ message_id: args.messageId });
    const targetUrl =
      args.mode === "link" ? (args.linkTargetUrl ?? this.webAppUrl) : this.webAppUrl;
    const body = {
      attachments: [
        buildDiscussInlineKeyboardAttachment({
          mode: args.mode,
          openAppWebApp: this.openAppId,
          openAppContactId: this.openAppContactId,
          linkUrl: targetUrl,
          buttonText: args.buttonText,
          startParam: args.startParam
        })
      ]
    };
    const jsonBody = JSON.stringify(body);
    console.log("=== MAX REQUEST META ===");
    console.log({
      url,
      method: "PUT"
    });
    console.log("=== MAX REQUEST JSON ===");
    console.log(jsonBody);
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: this.token,
        "content-type": "application/json"
      },
      body: jsonBody
    });
    const text = await response.text();
    const preview = text.slice(0, 16_000);
    let parsed: unknown = undefined;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      // leave parsed undefined
    }
    let maxSuccessFalseMessage: string | undefined;
    if (parsed && typeof parsed === "object" && "success" in parsed && (parsed as { success: unknown }).success === false) {
      maxSuccessFalseMessage = String((parsed as { message?: unknown }).message ?? "");
    }
    return {
      url,
      httpOk: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type"),
      responseBodyPreview: preview,
      parsed,
      maxSuccessFalseMessage
    };
  }

  async publishPost(payload: PublishPostPayload) {
    const url = this.buildMessagesUrl({ chat_id: payload.chatId });
    const body = {
      text: payload.text,
      attachments: [this.discussKeyboardAttachment(payload.buttonText, payload.startParam)]
    };
    this.logDiscussOutbound("POST /messages", body, payload.buttonText, payload.startParam);
    return this.maxJsonFetch("POST", url, body);
  }

  /** Generic message send with attachments (inline keyboards, etc). */
  async sendMessage(payload: { chatId: string; text: string; attachments?: unknown[] | null }) {
    const url = this.buildMessagesUrl({ chat_id: payload.chatId });
    const body: Record<string, unknown> = { text: payload.text };
    if (payload.attachments !== undefined) {
      body.attachments = payload.attachments;
    }
    return this.maxJsonFetch("POST", url, body);
  }

  /** Plain text only — no inline keyboard (moderation / service chats). */
  async sendPlainText(payload: { chatId: string; text: string }) {
    const url = this.buildMessagesUrl({ chat_id: payload.chatId });
    const body = { text: payload.text };
    return this.maxJsonFetch("POST", url, body);
  }

  /**
   * Updates only inline keyboard via official API (PUT /messages?message_id=…).
   * Docs: https://dev.max.ru/docs-api/methods/PUT/messages — `attachments` replaces keyboard when provided.
   */
  async editDiscussButton(payload: SyncButtonPayload) {
    const url = this.buildMessagesUrl({ message_id: payload.messageId });
    const body = {
      attachments: [this.discussKeyboardAttachment(payload.buttonText, payload.startParam)]
    };
    this.logDiscussOutbound("PUT /messages", body, payload.buttonText, payload.startParam);
    return this.maxJsonFetch("PUT", url, body);
  }
}
