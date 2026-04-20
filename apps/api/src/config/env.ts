import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z
  .object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  /**
   * Skip TCP/database-existence preflight in `server.ts` (e.g. rare test harnesses).
   * Production should leave this unset/false.
   */
  SKIP_DB_PREFLIGHT: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  /**
   * `full` (default): wait for TCP + verify target DB exists in pg_database (via maintenance URL).
   * `wait`: only wait for PostgreSQL to accept connections — use in CI where DB is created later by another job.
   * `off`: skip preflight (same intent as SKIP_DB_PREFLIGHT; prefer explicit `off` for documentation).
   */
  DB_PREFLIGHT_MODE: z
    .string()
    .optional()
    .transform((v) => {
      const t = v?.trim().toLowerCase();
      if (t === "wait") return "wait" as const;
      if (t === "off") return "off" as const;
      return "full" as const;
    }),
  /**
   * Optional URL for preflight only: must point to a database the role can **CONNECT** to (usually `postgres`)
   * for `pg_database` checks. Use when DATABASE_URL uses a non-superuser without CONNECT on `postgres`.
   */
  DATABASE_PREFLIGHT_ADMIN_URL: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().url().optional()
  ),
  API_PORT: z.coerce.number().default(3001),
  /** Behind Nginx / TLS terminator: trust X-Forwarded-* for correct proto/IP */
  TRUST_PROXY: z
    .string()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  /** MAX bot token: used to derive WebAppData initData secret per MAX docs (`HMAC_SHA256("WebAppData", token)`). */
  MAX_BOT_TOKEN: z.string().min(1),
  MAX_COMMENT_LENGTH: z.coerce.number().int().positive(),
  MAX_ATTACHMENTS_PER_COMMENT: z.coerce.number().int().positive(),
  MAX_IMAGE_SIZE_MB: z.coerce.number().positive(),
  COMMENT_EDIT_WINDOW_MINUTES: z.coerce.number().int().min(0),
  USER_CAN_DELETE_OWN_COMMENT: z
    .string()
    .transform((v) => v === "true" || v === "1")
    .default("true"),
  COMMENT_COOLDOWN_SECONDS: z.coerce.number().int().min(0),
  COMMENT_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive(),
  COMMENT_RATE_LIMIT_MAX: z.coerce.number().int().positive(),
  UPLOAD_DIR: z.string().min(1),
  UPLOAD_PUBLIC_BASE_URL: z.string().url(),
  ALLOWED_IMAGE_MIME_TYPES: z.string().min(1),
  ADMIN_SESSION_SECRET: z.string().min(1),
  ADMIN_SESSION_TTL_SECONDS: z.coerce.number().int().positive(),
  /** Admin session cookie SameSite: lax works across subdomains; strict if admin UI same-site only */
  ADMIN_COOKIE_SAME_SITE: z.enum(["lax", "strict"]).optional(),
  BOT_INTERNAL_BASE_URL: z.string().url().default("http://localhost:3002"),
  DEV_MAX_AUTH_BYPASS: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1")
    .default("false")
})
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production" && data.DEV_MAX_AUTH_BYPASS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DEV_MAX_AUTH_BYPASS cannot be true when NODE_ENV=production"
      });
    }
  });

export const env = schema.parse(process.env);

export function isDevMaxAuthBypassEnabled() {
  return env.NODE_ENV === "development" && env.DEV_MAX_AUTH_BYPASS;
}
