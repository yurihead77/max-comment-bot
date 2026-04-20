/**
 * CLI: database preflight (same logic as API startup).
 * Run from `apps/api`: `pnpm run db:preflight`
 *
 * Env:
 *   DATABASE_URL (required)
 *   DB_PREFLIGHT_MODE=full | wait | off  (default full)
 *   DATABASE_PREFLIGHT_ADMIN_URL (optional maintenance URL)
 *   SKIP_DB_PREFLIGHT=true — skip entirely (legacy)
 */
import dotenv from "dotenv";
import { runDbPreflight } from "../src/db/preflight";

dotenv.config();

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("db-preflight-cli: DATABASE_URL is missing or empty");
  process.exit(1);
}

const skipPreflight =
  process.env.SKIP_DB_PREFLIGHT === "true" ||
  process.env.SKIP_DB_PREFLIGHT === "1" ||
  process.env.DB_PREFLIGHT_MODE?.trim().toLowerCase() === "off";

if (skipPreflight) {
  console.error("db-preflight-cli: skipped (SKIP_DB_PREFLIGHT or DB_PREFLIGHT_MODE=off)");
  process.exit(0);
}

const modeRaw = process.env.DB_PREFLIGHT_MODE?.trim().toLowerCase();
const mode = modeRaw === "wait" ? "wait" : "full";
const admin = process.env.DATABASE_PREFLIGHT_ADMIN_URL?.trim() || undefined;

try {
  await runDbPreflight({
    databaseUrl: url,
    adminUrlOverride: admin,
    mode,
    log: (line) => {
      console.error(line);
    }
  });
  console.error(`db-preflight-cli: OK (mode=${mode})`);
  process.exit(0);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
