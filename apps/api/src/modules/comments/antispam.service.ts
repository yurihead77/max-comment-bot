import { env } from "../../config/env";

const lastCommentAt = new Map<string, number>();
const rateBucket = new Map<string, number[]>();

function key(userId: string, postId: string) {
  return `${userId}:${postId}`;
}

export function assertCooldown(userId: string, postId: string) {
  const now = Date.now();
  const k = key(userId, postId);
  const last = lastCommentAt.get(k) ?? 0;
  if (env.COMMENT_COOLDOWN_SECONDS > 0 && now - last < env.COMMENT_COOLDOWN_SECONDS * 1000) {
    throw new Error("cooldown active");
  }
  lastCommentAt.set(k, now);
}

export function assertRateLimit(userId: string, postId: string) {
  const now = Date.now();
  const k = key(userId, postId);
  const list = rateBucket.get(k) ?? [];
  const windowStart = now - env.COMMENT_RATE_LIMIT_WINDOW_SECONDS * 1000;
  const fresh = list.filter((ts) => ts >= windowStart);
  if (fresh.length >= env.COMMENT_RATE_LIMIT_MAX) {
    throw new Error("rate limit reached");
  }
  fresh.push(now);
  rateBucket.set(k, fresh);
}
