/**
 * MAX Bot API: webhook subscriptions (`GET|POST|DELETE /subscriptions`).
 * Same host and auth as messages API — see https://dev.max.ru/docs-api/methods/POST/subscriptions
 */

function normalizeApiBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function buildSubscriptionsUrl(
  baseUrl: string,
  apiVersion: string,
  query?: Record<string, string | undefined>
): string {
  const u = new URL("subscriptions", `${normalizeApiBase(baseUrl)}/`);
  u.searchParams.set("v", apiVersion);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") u.searchParams.set(k, v);
    }
  }
  return u.toString();
}

export const DEFAULT_WEBHOOK_UPDATE_TYPES = ["message_created", "bot_started"] as const;

export class MaxSubscriptionsHttpError extends Error {
  constructor(
    message: string,
    public readonly method: string,
    public readonly url: string,
    public readonly status: number,
    public readonly bodyPreview: string
  ) {
    super(message);
    this.name = "MaxSubscriptionsHttpError";
  }
}

async function readJsonOrText(response: Response, url: string, method: string): Promise<unknown> {
  const text = await response.text();
  const preview = text.slice(0, 4000);
  if (!response.ok) {
    throw new MaxSubscriptionsHttpError(
      `MAX subscriptions HTTP ${response.status}`,
      method,
      url,
      response.status,
      preview
    );
  }
  const trim = text.trim();
  if (trim.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function listSubscriptions(baseUrl: string, apiVersion: string, token: string): Promise<unknown> {
  const url = buildSubscriptionsUrl(baseUrl, apiVersion);
  const response = await fetch(url, { method: "GET", headers: { Authorization: token } });
  return readJsonOrText(response, url, "GET");
}

export type SubscribeWebhookBody = {
  url: string;
  update_types: string[];
  secret?: string;
};

export async function subscribeWebhook(
  baseUrl: string,
  apiVersion: string,
  token: string,
  body: SubscribeWebhookBody
): Promise<unknown> {
  const url = buildSubscriptionsUrl(baseUrl, apiVersion);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: token,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return readJsonOrText(response, url, "POST");
}

/** DELETE /subscriptions?url=… — `webhookUrl` must match the subscribed URL exactly. */
export async function unsubscribeWebhookByUrl(
  baseUrl: string,
  apiVersion: string,
  token: string,
  webhookUrl: string
): Promise<unknown> {
  const url = buildSubscriptionsUrl(baseUrl, apiVersion, { url: webhookUrl });
  const response = await fetch(url, { method: "DELETE", headers: { Authorization: token } });
  return readJsonOrText(response, url, "DELETE");
}
