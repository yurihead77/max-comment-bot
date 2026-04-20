/**
 * Minimal helpers for PostgreSQL URLs (Prisma `DATABASE_URL`) without extra deps.
 * Handles typical `postgresql://user:pass@host:port/dbname?schema=public` shapes.
 */

/** Host/port/db segment from URL (for logs and diagnostics). */
export function tcpEndpointFromConnectionString(connectionString: string): {
  host: string;
  port: number;
  database: string;
} {
  const normalized = connectionString.replace(/^postgresql:\/\//i, "http://");
  const u = new URL(normalized);
  const host = u.hostname.toLowerCase();
  const rawPort = u.port;
  const port =
    rawPort && rawPort.length > 0
      ? Number.parseInt(rawPort, 10)
      : 5432;
  if (!Number.isFinite(port)) {
    throw new Error(`Invalid DATABASE_URL: bad port "${rawPort}"`);
  }
  const pathSeg = u.pathname.replace(/^\//, "").split("/")[0];
  const database = pathSeg ? decodeURIComponent(pathSeg) : "postgres";
  return { host, port, database };
}

/** Mask password in a postgres URL for logs (best-effort). */
export function redactDatabaseUrl(connectionString: string): string {
  try {
    const normalized = connectionString.replace(/^postgresql:\/\//i, "http://");
    const u = new URL(normalized);
    if (u.password) u.password = "***";
    const rebuilt = u.toString().replace(/^http:\/\//i, "postgresql://");
    return rebuilt;
  } catch {
    return "<unparseable DATABASE_URL>";
  }
}

export function targetDatabaseNameFromUrl(connectionString: string): string {
  const qIdx = connectionString.indexOf("?");
  const base = qIdx === -1 ? connectionString : connectionString.slice(0, qIdx);
  const schemeIdx = base.indexOf("://");
  if (schemeIdx === -1) {
    throw new Error("Invalid DATABASE_URL: missing ://");
  }
  const slashIdx = base.indexOf("/", schemeIdx + 3);
  if (slashIdx === -1 || slashIdx === base.length - 1) {
    return "postgres";
  }
  const raw = base.slice(slashIdx + 1);
  if (!raw) return "postgres";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Same server/user/password/options, but connect to `newDatabase` (e.g. `postgres` for admin checks). */
export function withDatabaseName(connectionString: string, newDatabase: string): string {
  const qIdx = connectionString.indexOf("?");
  const noQuery = qIdx === -1 ? connectionString : connectionString.slice(0, qIdx);
  const query = qIdx === -1 ? "" : connectionString.slice(qIdx);
  const schemeIdx = noQuery.indexOf("://");
  if (schemeIdx === -1) {
    throw new Error("Invalid DATABASE_URL: missing ://");
  }
  const pathSlash = noQuery.indexOf("/", schemeIdx + 3);
  if (pathSlash === -1) {
    return `${noQuery}/${encodeURIComponent(newDatabase)}${query}`;
  }
  return `${noQuery.slice(0, pathSlash + 1)}${encodeURIComponent(newDatabase)}${query}`;
}
