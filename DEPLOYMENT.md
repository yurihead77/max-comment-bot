# Deployment Guide (MVP)

## Target

- Linux server
- Nginx as reverse proxy
- PM2 or Docker for process management
- PostgreSQL as main DB
- HTTPS required for MAX webhook

## Services

- `apps/api` on internal port `3001` (or behind Nginx as `/api`)
- `apps/bot` on internal port `3002` (webhook + internal `sync-button`)
- `apps/miniapp` static build behind Nginx
- `apps/admin` static build behind Nginx

**Mini app and admin (Vite):** set **`VITE_API_BASE_URL`** to the **browser-visible** API origin for every production build (CI/CD env or `.env.production`). If it is missing at build time, the bundle defaults to relative URLs (`""` / same origin as the static site). That only works when Nginx serves the API on the **same host and scheme** as the mini app or admin (e.g. both under `https://example.com` with `/api` proxied). Do **not** bake in `http://localhost:3001` for production: the browser would call the user’s machine, not your server, and HTTPS pages would hit mixed content.

## Build and database

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm build
```

`pnpm build` produces **bundled** Node entrypoints:

- `apps/api/dist/server.js`
- `apps/bot/dist/index.js`

Do **not** rely on `tsc`-only `dist/` for runtime; production uses the **tsup** output above.

## Production run commands

Working directory matters for `UPLOAD_DIR=./uploads` and Prisma.

**API**

```bash
cd /opt/max-comment-bot/apps/api
pnpm run start:prod
```

**Bot**

```bash
cd /opt/max-comment-bot/apps/bot
pnpm run start:prod
```

`pnpm run start:prod` in both apps is **`node dist/<entry>.js` only** — it does **not** pass `--env-file` and does **not** load `.env` by itself. All variables (`DATABASE_URL`, `MAX_*`, `UPLOAD_PUBLIC_BASE_URL`, etc.) must already exist in the process environment.

### Where production env comes from

Pick one (or combine) so the Node process inherits variables before `node` starts:

| Deployment | How env reaches `node dist/...` |
|------------|-----------------------------------|
| **systemd** | `Environment=` lines and/or `EnvironmentFile=/path/to/api.env` in the unit; run `ExecStart` from `WorkingDirectory=` `apps/api` or `apps/bot`. |
| **Shell / PM2 without file** | Export vars in the session, or PM2 `env` / `ecosystem.config.cjs` `env: { ... }`. |
| **PM2 with file** | `pm2 start ... --node-args="--env-file=/opt/.../api.env"` (optional; this is **not** part of `pnpm run start:prod`). |
| **Docker** | `ENV` / `environment:` in Compose, or `env_file:` pointing at a file mounted into the container. |

Use one canonical env source for API and bot (bot only needs the subset it reads; sharing one file is fine).

**Examples**

```bash
# systemd: variables already in the unit / EnvironmentFile
cd /opt/max-comment-bot/apps/api && /usr/bin/node dist/server.js
```

```bash
# one-off shell after `set -a; source /opt/max-comment-bot/apps/api/.env; set +a`
cd /opt/max-comment-bot/apps/api && node dist/server.js
```

**Environment flags**

- `NODE_ENV=production`
- `DEV_MAX_AUTH_BYPASS=false` (or omit) — при `production` + `true` API **не стартует** (Zod).
- `BOT_MOCK_MAX_API=false` (or omit) — в **production** бот с `BOT_MOCK_MAX_API=true` **завершится с ошибкой**; в development флаг лишь пропускает вызов MAX на `/internal/sync-button`.
- `TRUST_PROXY=true` — если Nginx передаёт `X-Forwarded-Proto` / `X-Forwarded-For` (нужно для корректных secure-cookie и логов за reverse proxy).
- `UPLOAD_PUBLIC_BASE_URL` — полный HTTPS URL префикса, по которому клиенты скачивают файлы (тот же хост, что проксирует `/uploads/`, или CDN). Без завершающего `/`.
- Admin cookie: `httpOnly`, `secure` в production, `sameSite` по умолчанию `strict` (prod) / `lax` (dev), TTL = `ADMIN_SESSION_TTL_SECONDS` + `maxAge`; переопределение: `ADMIN_COOKIE_SAME_SITE`.

## PM2 example

Optional `--env-file` loads the file into the Node process (separate from `pnpm run start:prod`):

```bash
pm2 start dist/server.js --name max-api -cwd /opt/max-comment-bot/apps/api --node-args="--env-file=/opt/max-comment-bot/apps/api/.env"
pm2 start dist/index.js --name max-bot -cwd /opt/max-comment-bot/apps/bot --node-args="--env-file=/opt/max-comment-bot/apps/api/.env"
```

Alternatively use PM2 `env` / ecosystem file or systemd `EnvironmentFile` and start plain `node dist/server.js` with no `--env-file`.

Adjust paths to your install root.

## Nginx

- Terminate TLS (HTTPS) for public endpoints.
- Proxy `/api` (or `/`) to the API upstream.
- Проксировать **`/uploads/`** на тот же upstream API (или на отдельный static/CDN — тогда выставьте `UPLOAD_PUBLIC_BASE_URL` под этот публичный хост).
- Route bot webhook path (e.g. `/webhook/max`) to the bot upstream.
- Serve `apps/miniapp/dist` and `apps/admin/dist` as static sites.

## Webhook

- MAX webhook URL must be **HTTPS** only.
- Restrict webhook access (secret header, IP allowlist) where possible.
- Keep polling disabled in production.
