import pg from "pg";
import {
  redactDatabaseUrl,
  targetDatabaseNameFromUrl,
  tcpEndpointFromConnectionString,
  withDatabaseName
} from "./connection-string";

const DEFAULT_MAX_ATTEMPTS = 60;
const DEFAULT_DELAY_MS = 1000;

export type DbPreflightMode = "full" | "wait" | "off";

export interface DbPreflightOptions {
  databaseUrl: string;
  /**
   * Connection string for the **maintenance** database used to wait on TCP + query `pg_database`
   * (default: same cluster/user as `DATABASE_URL` but database name `postgres`).
   * Required if the app DB user cannot `CONNECT` to `postgres` — use a superuser URL here only for preflight.
   */
  adminUrlOverride?: string | null;
  mode: DbPreflightMode;
  /** Called with diagnostic lines (API runs this before Fastify logger exists — use `console.error`). */
  log: (line: string) => void;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function pgErrorCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    const c = (err as { code?: unknown }).code;
    return typeof c === "string" ? c : undefined;
  }
  return undefined;
}

function isInsufficientPrivilege(err: unknown): boolean {
  const code = pgErrorCode(err);
  if (code === "42501" || code === "28000") return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /permission denied|must be owner|password authentication failed/i.test(msg);
}

/** Extra operator hint when TCP wait fails due to bad credentials (often same root cause as Prisma `P1000`). */
function connectionAuthHint(lastErr: unknown): string {
  const s = String(lastErr);
  if (/password authentication failed|28P01|authentication failed|SCRAM/i.test(s)) {
    return (
      ` Prisma surfaces the same class of problem as P1000 (Authentication failed). ` +
      `Align DATABASE_URL (and DATABASE_PREFLIGHT_ADMIN_URL if used) with the real role passwords on the server. ` +
      `Note: changing POSTGRES_PASSWORD in docker-compose does not alter passwords already stored in an existing Postgres data volume.`
    );
  }
  return "";
}

function resolveAdminUrl(databaseUrl: string, override?: string | null): string {
  const trimmed = override?.trim();
  if (trimmed) return trimmed;
  return withDatabaseName(databaseUrl, "postgres");
}

/**
 * Wait until PostgreSQL accepts a connection using `adminUrl` (maintenance DB).
 */
export async function waitForPostgresAdmin(
  adminUrl: string,
  opts?: { maxAttempts?: number; delayMs?: number }
): Promise<void> {
  const maxAttempts = opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const delayMs = opts?.delayMs ?? DEFAULT_DELAY_MS;
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    const c = new pg.Client({
      connectionString: adminUrl,
      connectionTimeoutMillis: 8000
    });
    try {
      await c.connect();
      await c.end();
      return;
    } catch (e) {
      lastErr = e;
      try {
        await c.end();
      } catch {
        /* ignore */
      }
      await sleep(delayMs);
    }
  }
  const ep = tcpEndpointFromConnectionString(adminUrl);
  throw new Error(
    `Database preflight: PostgreSQL unreachable after ${maxAttempts} attempts (~${Math.round((maxAttempts * delayMs) / 1000)}s). ` +
      `Checked maintenance TCP host=${ep.host} port=${ep.port} redacted_url=${redactDatabaseUrl(adminUrl)}. ` +
      `Last error: ${String(lastErr)}` +
      connectionAuthHint(lastErr)
  );
}

async function assertDatabaseExistsOnAdmin(adminUrl: string, targetDbName: string, log: (s: string) => void): Promise<void> {
  const c = new pg.Client({ connectionString: adminUrl, connectionTimeoutMillis: 8000 });
  try {
    await c.connect();
  } catch (e) {
    if (isInsufficientPrivilege(e)) {
      throw new Error(
        `Database preflight: cannot connect to maintenance database for pg_database check. ` +
          `The user in DATABASE_URL may lack CONNECT on database "postgres". ` +
          `Fix: set DATABASE_PREFLIGHT_ADMIN_URL to a URL that can connect (e.g. superuser …/postgres), or grant CONNECT. ` +
          `Redacted admin URL: ${redactDatabaseUrl(adminUrl)}. Underlying: ${String(e instanceof Error ? e.message : e)}`
      );
    }
    throw e;
  }

  try {
    let r: { rows: Array<{ exists: boolean }> };
    try {
      r = await c.query<{ exists: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
        [targetDbName]
      );
    } catch (e) {
      if (isInsufficientPrivilege(e)) {
        throw new Error(
          `Database preflight: connected to maintenance DB but cannot read pg_database (permission denied). ` +
            `Set DATABASE_PREFLIGHT_ADMIN_URL to a role allowed to read system catalogs, or use a superuser for preflight only. ` +
            `Redacted admin URL: ${redactDatabaseUrl(adminUrl)}. Underlying: ${String(e instanceof Error ? e.message : e)}`
        );
      }
      throw e;
    }

    const exists = r.rows[0]?.exists === true;
    if (!exists) {
      const commentsHint =
        targetDbName === "comments"
          ? ` Expected database is "comments" (common with docker-compose in this repo) but it is missing from pg_database. ` +
            `POSTGRES_DB only creates it on first init of an empty volume.`
          : " ";
      throw new Error(
        `Database preflight: database "${targetDbName}" does NOT exist in pg_database on this cluster (host/port from DATABASE_URL — see log lines above).` +
          commentsHint +
          `Create it (e.g. CREATE DATABASE "${targetDbName.replace(/"/g, '""')}";) or fix DATABASE_URL.`
      );
    }
    log(`[db-preflight] database_exists=true name="${targetDbName}"`);
  } finally {
    await c.end().catch(() => undefined);
  }
}

/**
 * Preflight: wait for PostgreSQL (`wait` | `full`) and optionally assert target DB exists (`full` only).
 */
export async function runDbPreflight(opts: DbPreflightOptions): Promise<void> {
  const { databaseUrl, mode, log } = opts;
  if (mode === "off") return;

  const targetDb = targetDatabaseNameFromUrl(databaseUrl);
  const appEp = tcpEndpointFromConnectionString(databaseUrl);
  const adminUrl = resolveAdminUrl(databaseUrl, opts.adminUrlOverride);

  log(
    `[db-preflight] mode=${mode} expected_database_name="${targetDb}" ` +
      `from_DATABASE_URL_host=${appEp.host} from_DATABASE_URL_port=${appEp.port} ` +
      `maintenance_connect_url=${redactDatabaseUrl(adminUrl)}` +
      (opts.adminUrlOverride?.trim() ? " (using DATABASE_PREFLIGHT_ADMIN_URL)" : ' (default: same user/host, database "postgres")')
  );

  log(`[db-preflight] step=wait_tcp postgres_accepting_connections=…`);

  try {
    await waitForPostgresAdmin(adminUrl);
  } catch (e) {
    log(
      `[db-preflight] step=wait_tcp postgres_accepting_connections=false ` +
        `diagnosis=server_not_reachable_or_refused maintenance_host=${tcpEndpointFromConnectionString(adminUrl).host} ` +
        `maintenance_port=${tcpEndpointFromConnectionString(adminUrl).port}`
    );
    throw e;
  }

  log(`[db-preflight] step=wait_tcp postgres_accepting_connections=true`);

  if (mode === "wait") {
    log(`[db-preflight] ok mode=wait (database existence NOT checked; use mode=full in production)`);
    return;
  }

  log(`[db-preflight] step=assert_database exists_check=pg_database.datname`);
  await assertDatabaseExistsOnAdmin(adminUrl, targetDb, log);
  log(`[db-preflight] ok mode=full expected_database_name="${targetDb}" postgres_tcp_ok=true database_exists=true`);
}

/** Full preflight with console diagnostics (e.g. standalone CLI). */
export async function assertTargetDatabaseExists(databaseUrl: string, adminUrlOverride?: string | null): Promise<void> {
  await runDbPreflight({
    databaseUrl,
    adminUrlOverride,
    mode: "full",
    log: (line) => {
      console.error(line);
    }
  });
}
