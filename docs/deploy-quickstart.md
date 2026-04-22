# Deploy Quickstart (External Developers)

This is the shortest path to a working production-like deployment.

For deep details (DB roles, preflight modes, Nginx, PM2/systemd variants), see `DEPLOYMENT.md`.

## 1) Prerequisites

- Linux host with Node.js 20+, pnpm 10+, PostgreSQL (or Docker for DB), and Nginx.
- Repository cloned to `/opt/max-comment-bot` (or your own path).
- HTTPS domains ready for API/bot/static apps.

## 2) Required environment variables

Use one canonical runtime env source (for example `/opt/max-comment-bot/.env.production`).
You can start from the repo template: `.env.production.example`.

Minimum required:

- Core:
  - `NODE_ENV=production`
  - `DATABASE_URL`
  - `ADMIN_SESSION_SECRET`
- MAX / bot:
  - `MAX_BOT_TOKEN`
  - `MAX_API_BASE_URL=https://platform-api.max.ru`
  - `MAX_WEBAPP_URL`
  - `MAX_OPEN_APP_ID`
  - `MAX_WEBHOOK_SECRET` (recommended)
  - `MAX_WEBHOOK_URL` (for webhook subscribe CLI)
- Wiring:
  - `BOT_INTERNAL_BASE_URL` (API -> bot internal route)
  - `UPLOAD_PUBLIC_BASE_URL` (browser-visible files URL prefix)

Build-time frontend variables:

- `apps/miniapp`: `VITE_API_BASE_URL`
- `apps/admin`: `VITE_API_BASE_URL`

## 3) Database + build bootstrap

From repo root:

```bash
cd /opt/max-comment-bot
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:preflight
pnpm db:deploy
pnpm db:seed
pnpm build
```

If DB auth fails (`P1000`) or DB is missing, follow the DB section in `DEPLOYMENT.md`.

## 4) Start API and bot

Example with PM2 and env-file:

```bash
pm2 start dist/server.js --name max-api -cwd /opt/max-comment-bot/apps/api --node-args="--env-file=/opt/max-comment-bot/.env.production"
pm2 start dist/index.js --name max-bot -cwd /opt/max-comment-bot/apps/bot --node-args="--env-file=/opt/max-comment-bot/.env.production"
```

Equivalent plain node commands (if env already exported by systemd/shell):

```bash
cd /opt/max-comment-bot/apps/api && node dist/server.js
cd /opt/max-comment-bot/apps/bot && node dist/index.js
```

## 5) Subscribe webhook

After bot URL/secret changes (or first deploy), run:

```bash
cd /opt/max-comment-bot
ENV_FILE=/opt/max-comment-bot/.env.production pnpm webhook:resubscribe
```

## 6) Health checks

```bash
curl -sf "http://127.0.0.1:3001/healthz"
curl -sf "http://127.0.0.1:3001/health/db"
curl -sf "http://127.0.0.1:3002/healthz"
```

If all three are OK, services are up and DB is usable.

## 7) Post-deploy smoke (recommended)

```bash
pnpm run smoke:functional
```

Expected output: `FUNCTIONAL_SMOKE_OK`.

For staging with real MAX webhooks/open_app, use `docs/staging-checklist.md` and `docs/max-integration-manual.md`.
If you want separate runtime env per service, use `docs/runtime-env-split-examples.md`.
