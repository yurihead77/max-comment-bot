import { createHash } from "node:crypto";

/** Non-reversible fingerprint for logs (never log raw `MAX_BOT_TOKEN`). */
export function maxBotTokenSha256Prefix(token: string, hexLen = 12): string {
  return createHash("sha256").update(token, "utf8").digest("hex").slice(0, hexLen);
}
