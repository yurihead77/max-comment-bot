import crypto from "node:crypto";
import { env } from "../../config/env";

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

export function validateAndParseInitData(initData: string): MaxAuthPayload {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    throw new Error("hash is missing");
  }

  params.delete("hash");
  const checkString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = crypto.createHash("sha256").update(env.MAX_INITDATA_SECRET).digest();
  const computedHash = crypto.createHmac("sha256", secret).update(checkString).digest("hex");
  if (computedHash !== hash) {
    throw new Error("initData hash mismatch");
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    throw new Error("user payload missing");
  }

  const payload: MaxAuthPayload = {
    user: JSON.parse(userRaw)
  };

  const chatRaw = params.get("chat");
  if (chatRaw) {
    payload.chat = JSON.parse(chatRaw);
  }
  const startParam = params.get("start_param");
  if (startParam) {
    payload.start_param = startParam;
  }

  return payload;
}
