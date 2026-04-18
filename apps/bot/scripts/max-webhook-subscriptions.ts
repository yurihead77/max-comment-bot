/**
 * CLI: register / list / remove MAX webhook subscriptions (POST|GET|DELETE /subscriptions).
 *
 * Env (same as bot, load from repo root `.env` or `apps/bot/.env`):
 *   MAX_BOT_TOKEN, MAX_API_BASE_URL, MAX_API_VERSION (optional), MAX_WEBHOOK_URL,
 *   MAX_WEBHOOK_SECRET (optional — omitted in POST body if empty)
 *
 * Usage:
 *   pnpm --filter @max-comment-bot/bot webhook:list
 *   pnpm --filter @max-comment-bot/bot webhook:subscribe
 *   pnpm --filter @max-comment-bot/bot webhook:unsubscribe
 *   pnpm --filter @max-comment-bot/bot webhook:resubscribe
 */

import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  DEFAULT_WEBHOOK_UPDATE_TYPES,
  listSubscriptions,
  MaxSubscriptionsHttpError,
  subscribeWebhook,
  unsubscribeWebhookByUrl
} from "../src/max-subscriptions.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(__dirname, "../../../.env") });
dotenv.config({ path: resolve(__dirname, "../.env"), override: true });

const envSchema = z.object({
  MAX_BOT_TOKEN: z.string().min(1, "MAX_BOT_TOKEN is required"),
  MAX_API_BASE_URL: z.string().url().default("https://platform-api.max.ru"),
  MAX_API_VERSION: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : "1.2.5")),
  MAX_WEBHOOK_URL: z.string().url().optional(),
  MAX_WEBHOOK_SECRET: z.string().optional()
});

function printJson(label: string, data: unknown): void {
  console.log(`\n--- ${label} ---`);
  console.log(typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

function parseArgs(argv: string[]): { cmd: string; webhookUrl?: string } {
  const [, , cmdRaw, ...rest] = argv;
  const cmd = cmdRaw ?? "help";
  let webhookUrl: string | undefined;
  for (const a of rest) {
    if (a.startsWith("--url=")) webhookUrl = a.slice("--url=".length);
  }
  return { cmd, webhookUrl };
}

async function main(): Promise<void> {
  const { cmd, webhookUrl: urlArg } = parseArgs(process.argv);
  const env = envSchema.parse(process.env);
  const { MAX_BOT_TOKEN, MAX_API_BASE_URL, MAX_API_VERSION } = env;
  const webhookUrl = urlArg ?? env.MAX_WEBHOOK_URL;

  if (cmd === "help" || cmd === "-h" || cmd === "--help") {
    console.log(`Commands:
  list              GET /subscriptions
  subscribe         POST /subscriptions (needs MAX_WEBHOOK_URL or --url=)
  unsubscribe       DELETE /subscriptions?url=… (needs MAX_WEBHOOK_URL or --url=)
  resubscribe       unsubscribe then subscribe (same URL)

Env: MAX_BOT_TOKEN, MAX_API_BASE_URL, MAX_API_VERSION, MAX_WEBHOOK_URL, MAX_WEBHOOK_SECRET`);
    process.exit(0);
  }

  try {
    if (cmd === "list") {
      const data = await listSubscriptions(MAX_API_BASE_URL, MAX_API_VERSION, MAX_BOT_TOKEN);
      printJson("GET /subscriptions", data);
      return;
    }

    if (!webhookUrl && (cmd === "subscribe" || cmd === "unsubscribe" || cmd === "resubscribe")) {
      console.error("Set MAX_WEBHOOK_URL or pass --url=https://…/webhook/max");
      process.exit(1);
    }

    if (cmd === "subscribe") {
      const body: {
        url: string;
        update_types: string[];
        secret?: string;
      } = {
        url: webhookUrl!,
        update_types: [...DEFAULT_WEBHOOK_UPDATE_TYPES]
      };
      if (env.MAX_WEBHOOK_SECRET && env.MAX_WEBHOOK_SECRET.length > 0) {
        body.secret = env.MAX_WEBHOOK_SECRET;
      }
      printJson("POST /subscriptions body", body);
      const data = await subscribeWebhook(MAX_API_BASE_URL, MAX_API_VERSION, MAX_BOT_TOKEN, body);
      printJson("POST /subscriptions response", data);
      return;
    }

    if (cmd === "unsubscribe") {
      const data = await unsubscribeWebhookByUrl(
        MAX_API_BASE_URL,
        MAX_API_VERSION,
        MAX_BOT_TOKEN,
        webhookUrl!
      );
      printJson("DELETE /subscriptions response", data);
      return;
    }

    if (cmd === "resubscribe") {
      console.log("Step 1: DELETE old subscription (if any)…");
      try {
        const del = await unsubscribeWebhookByUrl(
          MAX_API_BASE_URL,
          MAX_API_VERSION,
          MAX_BOT_TOKEN,
          webhookUrl!
        );
        printJson("DELETE /subscriptions", del);
      } catch (e) {
        if (e instanceof MaxSubscriptionsHttpError && (e.status === 404 || e.status === 400)) {
          console.log("(DELETE not applicable or no matching subscription — continuing)\n", e.bodyPreview.slice(0, 500));
        } else {
          throw e;
        }
      }
      console.log("\nStep 2: POST new subscription…");
      const body: { url: string; update_types: string[]; secret?: string } = {
        url: webhookUrl!,
        update_types: [...DEFAULT_WEBHOOK_UPDATE_TYPES]
      };
      if (env.MAX_WEBHOOK_SECRET && env.MAX_WEBHOOK_SECRET.length > 0) {
        body.secret = env.MAX_WEBHOOK_SECRET;
      }
      const data = await subscribeWebhook(MAX_API_BASE_URL, MAX_API_VERSION, MAX_BOT_TOKEN, body);
      printJson("POST /subscriptions response", data);
      return;
    }

    console.error(`Unknown command: ${cmd}`);
    process.exit(1);
  } catch (e) {
    if (e instanceof MaxSubscriptionsHttpError) {
      console.error(e.message, e.status);
      console.error("URL:", e.url);
      console.error("Body:", e.bodyPreview);
      process.exit(1);
    }
    throw e;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
