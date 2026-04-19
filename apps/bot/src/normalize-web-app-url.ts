/**
 * Canonical form of the mini app URL sent in `open_app.web_app`.
 * MAX resolves the button against a registered **Link**; trivial differences
 * (host casing, default port, `/` vs empty path, trailing slash on a path)
 * can still break lookup — this keeps one stable shape from env.
 */
export function normalizeWebAppUrl(raw: string): string {
  const trimmed = raw.trim();
  const u = new URL(trimmed);
  u.hostname = u.hostname.toLowerCase();
  if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) {
    u.port = "";
  }
  let path = u.pathname;
  if (path.length > 1 && path.endsWith("/")) {
    path = path.replace(/\/+$/, "");
    u.pathname = path;
  }
  if (path === "/" || path === "") {
    return `${u.origin}${u.search}${u.hash}`;
  }
  return `${u.origin}${u.pathname}${u.search}${u.hash}`;
}
