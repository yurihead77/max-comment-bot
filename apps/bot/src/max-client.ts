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
  /** Structured log of outgoing `open_app` keyboard JSON (POST/PUT messages). */
  logOpenAppPayload?: MaxClientLogOpenAppPayload;
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

/**
 * MAX Bot HTTP API (see https://dev.max.ru/docs-api).
 * Uses `POST /messages` + `PUT /messages?message_id=…` with `Authorization: <token>` and query `v=<api version>`.
 * The legacy Telegram-style `/bot<token>/sendMessage` / `editMessageReplyMarkup` paths are not used on platform-api.max.ru.
 */
export class MaxClient {
  private readonly apiVersion: string;
  private readonly logOpenAppPayload?: MaxClientLogOpenAppPayload;

  constructor(
    private readonly token: string,
    /** API origin, e.g. https://platform-api.max.ru (not the mini app site). */
    private readonly baseUrl: string,
    /** Mini app URL for `open_app` button (`web_app` string); must match link registered in MAX (see normalizeWebAppUrl at call site). */
    private readonly webAppUrl: string,
    opts?: MaxClientOptions
  ) {
    this.apiVersion = opts?.apiVersion ?? "1.2.5";
    this.logOpenAppPayload = opts?.logOpenAppPayload;
  }

  /** Diagnostic: POST /messages?chat_id=…&v=… (token only in Authorization header). */
  postMessagesUrl(chatId: string): string {
    return this.buildMessagesUrl({ chat_id: chatId });
  }

  /** Diagnostic: PUT /messages?message_id=…&v=… */
  putMessagesUrl(messageId: string): string {
    return this.buildMessagesUrl({ message_id: messageId });
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

  /** MAX inline_keyboard + open_app (see max-bot-api-client-go `OpenAppButton`, `web_app` string). */
  private openAppKeyboardAttachment(buttonText: string, startParam: string) {
    return {
      type: "inline_keyboard",
      payload: {
        buttons: [
          [
            {
              type: "open_app",
              text: buttonText,
              web_app: this.webAppUrl,
              payload: startParam
            }
          ]
        ]
      }
    };
  }

  private logOpenAppOutbound(operation: string, body: unknown, buttonText: string, startParam: string): void {
    if (!this.logOpenAppPayload) return;
    let host: string | undefined;
    try {
      host = new URL(this.webAppUrl).host;
    } catch {
      host = undefined;
    }
    const serialized = JSON.stringify(body);
    this.logOpenAppPayload({
      maxOpenAppOutgoing: true,
      operation,
      buttonText,
      startParam,
      webAppUrl: this.webAppUrl,
      webAppHost: host,
      attachmentsJsonPreview: serialized.slice(0, 16_000),
      attachmentsJsonLen: serialized.length
    });
  }

  private async maxJsonFetch(method: "POST" | "PUT", url: string, body: unknown): Promise<unknown> {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: this.token,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const parsed = await readMaxJsonResponse(response, url);
    const preview = JSON.stringify(parsed).slice(0, 300);
    assertMaxCommandSuccess(parsed, url, response.status, response.headers.get("content-type"), preview);
    return parsed;
  }

  async publishPost(payload: PublishPostPayload) {
    const url = this.buildMessagesUrl({ chat_id: payload.chatId });
    const body = {
      text: payload.text,
      attachments: [this.openAppKeyboardAttachment(payload.buttonText, payload.startParam)]
    };
    this.logOpenAppOutbound("POST /messages", body, payload.buttonText, payload.startParam);
    return this.maxJsonFetch("POST", url, body);
  }

  /**
   * Updates only inline keyboard via official API (PUT /messages?message_id=…).
   * Docs: https://dev.max.ru/docs-api/methods/PUT/messages — `attachments` replaces keyboard when provided.
   */
  async editDiscussButton(payload: SyncButtonPayload) {
    const url = this.buildMessagesUrl({ message_id: payload.messageId });
    const body = {
      attachments: [this.openAppKeyboardAttachment(payload.buttonText, payload.startParam)]
    };
    this.logOpenAppOutbound("PUT /messages", body, payload.buttonText, payload.startParam);
    return this.maxJsonFetch("PUT", url, body);
  }
}
