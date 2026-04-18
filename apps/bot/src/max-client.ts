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

function buildBotMethodUrl(baseUrl: string, token: string, method: string): string {
  return `${normalizeApiBase(baseUrl)}/bot${token}/${method}`;
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

export class MaxClient {
  constructor(
    private readonly token: string,
    /** Must be MAX Bot HTTP API origin (e.g. https://api.max.ru), not the mini app URL. */
    private readonly baseUrl: string,
    /** Mini app URL for open_app only; never used as fetch() base for MAX API. */
    private readonly webAppUrl: string
  ) {}

  /** Exact URL used for editMessageReplyMarkup (for logs / debugging). */
  editMessageReplyMarkupUrl(): string {
    return buildBotMethodUrl(this.baseUrl, this.token, "editMessageReplyMarkup");
  }

  /** Exact URL used for sendMessage. */
  sendMessageUrl(): string {
    return buildBotMethodUrl(this.baseUrl, this.token, "sendMessage");
  }

  async publishPost(payload: PublishPostPayload) {
    const url = this.sendMessageUrl();
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: payload.chatId,
        text: payload.text,
        reply_markup: {
          inline_keyboard: [
            [
              {
                type: "open_app",
                text: payload.buttonText,
                web_app: {
                  url: this.webAppUrl,
                  start_param: payload.startParam
                }
              }
            ]
          ]
        }
      })
    });
    return readMaxJsonResponse(response, url);
  }

  async editDiscussButton(payload: SyncButtonPayload) {
    const url = this.editMessageReplyMarkupUrl();
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: payload.chatId,
        message_id: payload.messageId,
        reply_markup: {
          inline_keyboard: [
            [
              {
                type: "open_app",
                text: payload.buttonText,
                web_app: {
                  url: this.webAppUrl,
                  start_param: payload.startParam
                }
              }
            ]
          ]
        }
      })
    });
    return readMaxJsonResponse(response, url);
  }
}
