import crypto from "node:crypto";

export interface MaxAuthPayload {
  user: {
    id: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    photo_url?: string;
  };
  chat?: {
    id: string;
    type?: string;
    title?: string;
  };
  start_param?: string;
}

function decodeInitDataValue(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    throw new MaxInitDataValidationError("invalid initData value encoding", 400);
  }
}

export class MaxInitDataValidationError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 401
  ) {
    super(message);
    this.name = "MaxInitDataValidationError";
  }
}

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * MAX WebApp initData validation (raw `window.WebApp.initData`), per MAX docs:
 * split by `&`, drop `hash`, URL-decode values, sort keys, join with `\n`,
 * secret_key = HMAC_SHA256("WebAppData", bot_token),
 * signature = hex(HMAC_SHA256(secret_key, launch_params)).
 */
export function parseAndVerifyMaxInitData(initData: string, botToken: string): MaxAuthPayload {
  if (!initData.trim()) {
    throw new MaxInitDataValidationError("initData is empty", 400);
  }

  const rawByKey = new Map<string, string>();
  const hashRawParts: string[] = [];

  for (const part of initData.split("&")) {
    if (part.length === 0) continue;
    const eq = part.indexOf("=");
    const key = eq === -1 ? part : part.slice(0, eq);
    const rawValue = eq === -1 ? "" : part.slice(eq + 1);
    if (key === "hash") {
      hashRawParts.push(rawValue);
      continue;
    }
    rawByKey.set(key, rawValue);
  }

  if (hashRawParts.length === 0) {
    throw new MaxInitDataValidationError("hash is missing", 400);
  }
  if (hashRawParts.length !== 1) {
    throw new MaxInitDataValidationError("hash must appear exactly once", 400);
  }

  const receivedHash = decodeInitDataValue(hashRawParts[0]!);

  const sorted = [...rawByKey.entries()].sort(([a], [b]) => a.localeCompare(b));
  const launchParams = sorted.map(([k, raw]) => `${k}=${decodeInitDataValue(raw)}`).join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHex = crypto.createHmac("sha256", secretKey).update(launchParams).digest("hex");

  if (!timingSafeEqualHex(computedHex, receivedHash)) {
    const paramKeys = sorted.map(([k]) => k);
    console.warn("MAX initData validation failed", {
      hasHash: true,
      paramKeys,
      computedHashPrefix: computedHex.slice(0, 12),
      receivedHashPrefix: receivedHash.slice(0, 12)
    });
    throw new MaxInitDataValidationError("initData hash mismatch", 401);
  }

  const userRaw = decodeInitDataValue(rawByKey.get("user") ?? "");
  if (!userRaw) {
    throw new MaxInitDataValidationError("user payload missing", 400);
  }

  let user: MaxAuthPayload["user"];
  try {
    user = JSON.parse(userRaw) as MaxAuthPayload["user"];
  } catch {
    throw new MaxInitDataValidationError("user payload is not valid JSON", 400);
  }

  const payload: MaxAuthPayload = { user };

  const chatRawEncoded = rawByKey.get("chat");
  if (chatRawEncoded !== undefined) {
    const chatRaw = decodeInitDataValue(chatRawEncoded);
    if (chatRaw) {
      try {
        payload.chat = JSON.parse(chatRaw) as NonNullable<MaxAuthPayload["chat"]>;
      } catch {
        throw new MaxInitDataValidationError("chat payload is not valid JSON", 400);
      }
    }
  }

  const startRaw = rawByKey.get("start_param");
  if (startRaw !== undefined) {
    const startParam = decodeInitDataValue(startRaw);
    if (startParam) {
      payload.start_param = startParam;
    }
  }

  return payload;
}
