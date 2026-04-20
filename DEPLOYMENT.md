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

### PostgreSQL (Docker) and `DATABASE_URL`

Prisma reads **`DATABASE_URL`** from the process environment (see `apps/api/prisma/schema.prisma`). The **database name** in the URL path must **already exist** on the server.

**Recommended local/server layout:** run PostgreSQL from the repo’s **`docker-compose.yml`**:

- Service / container name: **`comments-db`** (`postgres:15`).
- Credentials: **`postgres` / `postgres`** (template only — change for real deployments).
- Database created on **first** init of an empty data volume: **`comments`** (`POSTGRES_DB`).
- Named volume: **`comments_pgdata`** → data survives container restarts.

```bash
docker compose up -d
# Wait until healthy (optional):
docker compose ps
./scripts/wait-for-db.sh          # optional: pg_isready loop (postgresql-client)
./scripts/preflight-db-check.sh   # wait + verify DB exists in pg_database (postgresql-client)
```

**Important:** `POSTGRES_DB` is applied by the official Postgres image **only when `PGDATA` is empty** (first run). If the volume already exists from an older run **without** that database, or the DB was dropped, **restarting the container does not recreate `comments`**. You must `CREATE DATABASE comments` manually (or remove the volume — **destructive** — see limitations below).

**`DATABASE_URL` examples**

| Where API runs | Example `DATABASE_URL` |
|----------------|-------------------------|
| Host / IDE, Postgres published on `localhost:5432` | `postgresql://postgres:postgres@127.0.0.1:5432/comments?schema=public` |
| Another Docker container on the **same Compose network** as `comments-db` | `postgresql://postgres:postgres@comments-db:5432/comments?schema=public` |

If you intentionally use another database name (e.g. legacy **`max_comment_bot`**), create it yourself and point `DATABASE_URL` at that name.

### Canonical server flow (Postgres → migrations → API → smoke)

Use this as the **single ops checklist** (adjust paths and `pm2` name):

```bash
docker compose up -d comments-db
cd /opt/max-comment-bot   # repo root
pnpm db:preflight
pnpm db:deploy
pm2 restart max-api       # example; cwd should be apps/api or use ecosystem file
curl -sf "http://127.0.0.1:3001/health/db"
```

One-command variant (runs the same checks and fails fast on any step):

```bash
cd /opt/max-comment-bot
pnpm ops:verify
```

- **`pnpm db:preflight`** — same logic as API startup: wait on TCP (via maintenance URL), then **`full`** mode checks `pg_database` for the DB named in **`DATABASE_URL`**.
- **`curl …/health/db`** — confirms Prisma can query after the process is up (replace port if **`API_PORT`** is not `3001`).

### API startup preflight and health

Before binding **`API_PORT`**, the API runs **`runDbPreflight`** (`apps/api/src/server.ts` + `apps/api/src/db/preflight.ts`):

| Step | What happens |
|------|----------------|
| Log | Lines prefixed with **`[db-preflight]`**: expected database name, **host/port parsed from `DATABASE_URL`**, redacted maintenance URL. |
| Wait | Connect using the **maintenance** URL until PostgreSQL accepts connections or timeout. |
| Assert (`full` only) | `SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = …)` for the **target** database from `DATABASE_URL`. |

**Modes — `DB_PREFLIGHT_MODE`:**

| Value | Behaviour |
|-------|-----------|
| **`full`** (default) | Wait + assert database exists (recommended **production**). |
| **`wait`** | Wait for PostgreSQL only — **does not** check that the target DB exists (for CI where another job creates the DB **after** the wait). |
| **`off`** | Skip preflight entirely (same practical effect as **`SKIP_DB_PREFLIGHT=true`**; prefer **`off`** when documenting “preflight disabled”). |

**Maintenance URL and application-only users**

By default preflight connects to database **`postgres`** on the same host/user as **`DATABASE_URL`** to read **`pg_database`**. If the app role **cannot** `CONNECT` to `postgres` (common for locked-down users), preflight fails with an explicit message — **not** “database `comments` missing”. Fix one of:

- set **`DATABASE_PREFLIGHT_ADMIN_URL`** to a URL that can connect (e.g. superuser …`/postgres`) **only for preflight**; or  
- grant the app user **`CONNECT`** on `postgres` (policy decision).

Operational checks:

- **`GET /healthz`** — process up (no DB check).
- **`GET /health/db`** — runs `SELECT 1` via Prisma; **`503`** if the app cannot use the DB (good for load balancers after restarts).

Standalone CLI (same env as API):

```bash
cd apps/api && pnpm run db:preflight
# or from repo root:
pnpm db:preflight
```

`SKIP_DB_PREFLIGHT=true` still skips all of the above (legacy escape hatch; avoid in production).

### Migrations (dev vs server)

| Command | When |
|---------|------|
| **`pnpm db:migrate:dev`** | Local development: creates migration files + applies (`prisma migrate dev`). |
| **`pnpm db:deploy`** | **Servers / CI / production:** applies existing migrations only (`prisma migrate deploy`). **Do not** use `migrate dev` there. |

From the repo root after DB is up:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:deploy
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

**MAX webhook subscription** (не настраивается URL мини-приложения в UI): один раз после смены URL или секрета вызовите из корня репозитория. Переменные должны совпадать с теми, что у бота (например **`/opt/max-comment-bot/.env.production`** при **`--env-file`** в PM2):

```bash
cd /opt/max-comment-bot
ENV_FILE=/opt/max-comment-bot/.env.production pnpm webhook:list
ENV_FILE=/opt/max-comment-bot/.env.production pnpm webhook:resubscribe
# или: set -a && source /opt/max-comment-bot/.env.production && set +a && pnpm webhook:resubscribe
```

Подробнее: **`docs/webhook-max.md`**.

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

**`DATABASE_URL` in production:** the database in the URL must exist; **`pnpm db:deploy`** does not create the empty database. Use preflight / **`GET /health/db`** after deploy. If env still points at a missing name, the API fails during **database preflight** (clear log) or Prisma connect (**P1003**).

### Backups (helper scripts)

- **`scripts/backup-db.sh`** — `pg_dump` of **`COMMENTS_DB`** (default `comments`). Creates **`./backups/`** when using the default timestamped filename; refuses to overwrite an existing file; verifies the dump is **non-empty** after `pg_dump`. Requires **`postgresql-client`** and **`PGPASSWORD`** (and optional **`PGHOST`** / **`PGPORT`**).
- **`scripts/restore-db.sh`** — `psql -f` restore. Requires **`RESTORE_CONFIRM=YES`** (exact), explicit dump path, prints a **large warning** and waits **5 seconds** before running. Read the script header before use.

### What this repository cannot enforce

- **Manual `docker volume rm`** (or deleting host data) — data loss is outside application code.
- **Wrong `DATABASE_URL` in systemd/PM2** after a restart — operators must keep env in sync with the real cluster.
- **Postgres up but wrong credentials** — preflight checks existence on the server you reach; auth errors still surface from PostgreSQL.
- **Order when API is not in Compose** — use preflight in the API process, `./scripts/wait-for-db.sh`, or orchestration (systemd `After=docker.service`, etc.).

### Optional: API in Docker with `depends_on`

If you later add an **`api`** service to Compose, use:

```yaml
depends_on:
  comments-db:
    condition: service_healthy
```

This file ships **only** `comments-db` so non-Docker API installs stay simple; copy the snippet into your own compose overlay if needed.

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
- `MAX_API_BASE_URL` — для бота: **`https://platform-api.max.ru`** (официальный Bot API). Пути Telegram-стиля `/bot<token>/…` на `api.max.ru` дают **404 HTML**; см. `docs/webhook-max.md`. Опционально `MAX_API_VERSION` (query `v`, по умолчанию `1.2.5`).
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
