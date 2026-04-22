# MAX Comment Bot MVP

Monorepo skeleton for MAX post discussions:

- `apps/api` — Fastify + Prisma API (public/admin/internal)
- `apps/bot` — MAX bot integration (publish + sync inline button)
- `apps/miniapp` — user mini app for comments
- `apps/admin` — admin panel for moderation/restrictions
- `packages/shared` — shared types

## Prerequisites

- Node.js 20+ (uses `node --env-file` in examples)
- pnpm 10+
- PostgreSQL reachable from `DATABASE_URL` (quick option: **`docker compose up -d`** in repo root — see **`DEPLOYMENT.md`**)

## Local setup

1. Copy root env template and edit values:

```bash
cp .env.example .env
```

For API, either keep a single `apps/api/.env` (recommended for Prisma CLI) or symlink it from the root `.env`.

2. Install and generate Prisma client:

```bash
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm db:seed
```

3. **Production-style build** (bundled entrypoints; runnable with plain `node`):

```bash
pnpm build
```

4. **Run API** (from `apps/api` so `./uploads` and `.env` resolve correctly):

```bash
cd apps/api
node --env-file=.env dist/server.js
```

5. **Run bot** (same env file is fine; uses `BOT_PORT`, `MAX_*`, etc.):

```bash
cd apps/bot
node --env-file=../api/.env dist/index.js
```

6. **Mini app / admin (Vite dev)** — `VITE_API_BASE_URL` (see `.env.example`) and dev-mock flags. For **production static builds**, set `VITE_API_BASE_URL` to the public API URL in CI, or omit it only if the API is served **same origin** as the static app (see `DEPLOYMENT.md`); do not rely on a `localhost` default in the browser.

```bash
cp apps/miniapp/.env.example apps/miniapp/.env
cp apps/admin/.env.example apps/admin/.env
pnpm --filter @max-comment-bot/miniapp dev
pnpm --filter @max-comment-bot/admin dev
```

### Dev bypass for MAX (local only)

In `apps/api/.env`:

- `NODE_ENV=development`
- `DEV_MAX_AUTH_BYPASS=true` — allows `POST /api/auth/max/init` with JSON `{ "devMock": { ... } }` instead of real `initData`.

In `apps/miniapp/.env`:

- `VITE_DEV_MAX_AUTH=true` — mini app calls dev-mock auth and can use `?postId=<uuid>` or `VITE_DEV_POST_ID`.

**Production guard:** если в `.env` одновременно `NODE_ENV=production` и `DEV_MAX_AUTH_BYPASS=true`, процесс API **не стартует** (ошибка валидации Zod). В коде dev-mock разрешён только при `NODE_ENV === "development"`.

**Never** enable `DEV_MAX_AUTH_BYPASS` in production.

### Bot: skip real MAX on sync (local CI only)

In `apps/api/.env` (bot reads the same file when started with `--env-file=../api/.env`):

- `BOT_MOCK_MAX_API=true` — in **development**, `/internal/sync-button` on the bot returns success without calling MAX.

Set to `false` in real deployments.

## Turborepo shortcuts

```bash
pnpm dev          # parallel dev (tsx / vite)
pnpm run typecheck
pnpm run build
```

## Quick Deploy (external devs)

Minimal server bootstrap sequence (after cloning repo to `/opt/max-comment-bot`):

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:preflight
pnpm db:deploy
pnpm db:seed
pnpm build
```

Run processes (example with PM2 + existing env file):

```bash
pm2 start dist/server.js --name max-api -cwd /opt/max-comment-bot/apps/api --node-args="--env-file=/opt/max-comment-bot/.env.production"
pm2 start dist/index.js --name max-bot -cwd /opt/max-comment-bot/apps/bot --node-args="--env-file=/opt/max-comment-bot/.env.production"
```

Then verify:

```bash
curl -sf "http://127.0.0.1:3001/healthz"
curl -sf "http://127.0.0.1:3001/health/db"
curl -sf "http://127.0.0.1:3002/healthz"
ENV_FILE=/opt/max-comment-bot/.env.production pnpm webhook:resubscribe
```

For full production details (Nginx, DB roles, preflight modes, env sourcing): see `DEPLOYMENT.md`.
Fast onboarding one-pager: `docs/deploy-quickstart.md`.
Runtime env template for servers: `.env.production.example`.
Split API/bot env examples (systemd/PM2): `docs/runtime-env-split-examples.md`.

## Functional smoke (automated)

Требуется заполненный `apps/api/.env` (БД, `ADMIN_SESSION_SECRET`, seed-админ и т.д.). Скрипт сам поднимает **собранные** `dist/server.js` и `dist/index.js` и для дочернего API выставляет `NODE_ENV=development` + `DEV_MAX_AUTH_BYPASS=true` (ваш файл `.env` может оставаться с `NODE_ENV=production` — дочерний процесс всё равно получит dev-флаги для теста).

Из корня репозитория (после `pnpm build`):

```bash
pnpm run smoke:functional
```

Эквивалентно: `node --env-file=apps/api/.env scripts/smoke-functional.mjs`.

Успех: в консоли **`FUNCTIONAL_SMOKE_OK`**.

## Воспроизведение «с нуля» (чеклист)

```bash
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm run build
pnpm run smoke:functional
```

Перед этим поднимите PostgreSQL (см. **`docker-compose.yml`** и **`DEPLOYMENT.md`**) и создайте `apps/api/.env` с рабочим **`DATABASE_URL`**. Имя БД в URL должно существовать (для compose по умолчанию — **`comments`**). Рекомендуется роль приложения **`commentbot`** (не суперпользователь `postgres`) и отдельный пароль в env — см. **`DEPLOYMENT.md`** (bootstrap SQL, **`P1000`**, дрейф пароля на существующем Docker volume). Preflight: **`DB_PREFLIGHT_MODE`** / **`DATABASE_PREFLIGHT_ADMIN_URL`**. Канонический порядок на сервере: **`docker compose up -d comments-db`** → **`pnpm db:preflight`** → **`pnpm db:deploy`** → **`pm2 restart commentbot-api --update-env`** → **`curl /health/db`** → **`pm2 restart commentbot-bot --update-env`**. Схемы: **`pnpm db:deploy`** (сервер), новые миграции локально: **`pnpm db:migrate:dev`**.
Для быстрого server/staging-check есть скрипт **`pnpm ops:verify`** (см. `scripts/ops-verify.sh`).

## Публичные URL загрузок и Nginx

- Вложениям в БД сохраняется публичный URL: завершающие слэши у **`UPLOAD_PUBLIC_BASE_URL`** обрезаются, затем добавляется **`/` + filename`** (без двойного слэша в пути). Это URL, который **браузер пользователя** должен уметь открыть (mini app / клиент MAX). Проверка логики: `node scripts/verify-upload-public-url.mjs`.
- Задайте **`UPLOAD_PUBLIC_BASE_URL`** как полный HTTPS-origin того хоста/пути, который отдаёт файлы, например `https://api.example.com` если Nginx проксирует `/uploads/` на тот же API, или `https://cdn.example.com` при отдельном хосте.
- Отдельного `APP_BASE_URL` в коде нет: достаточно корректно выставить **`UPLOAD_PUBLIC_BASE_URL`** (и при необходимости `TRUST_PROXY=true` на API за reverse proxy — см. `DEPLOYMENT.md`).

## Admin session cookie

- **`httpOnly: true`**, **`path: /`**, **`maxAge`** = `ADMIN_SESSION_TTL_SECONDS`, **`expires`** согласован с TTL.
- **`secure: true`** только при `NODE_ENV=production` (на HTTP в dev cookie доставляется без Secure).
- **`sameSite`**: по умолчанию `strict` в production и `lax` в dev/test; переопределение: **`ADMIN_COOKIE_SAME_SITE=lax|strict`** в `apps/api/.env`.

Живая интеграция с MAX (publish → open_app → комментарий → sync): [docs/max-integration-manual.md](docs/max-integration-manual.md).

Staging на реальном MAX: [docs/staging-checklist.md](docs/staging-checklist.md).

See [docs/smoke-checklist.md](docs/smoke-checklist.md) for the full manual + automated checklist.

## MVP scope notes

- Flat comments only (no nested threads), with reply preview (`replyToCommentId` + `replyPreview`) in message bubble.
- Per-post system thread header (`kind=thread_header`) is created idempotently on register and shown first in discussion.
- Public feed shows only `active` comments.
- Public feed returns thread header first, then comments in chronological order.
- Delete is soft only (`status=deleted`).
- Restrictions are global for MVP.
- Moderator can hide/delete/restore comments (no text edit).
- User can edit/delete only own comments per env config.
- `sync-button` uses safe MAX merge flow: `GET /messages?message_ids=...` → preserve text + media attachments → replace only `inline_keyboard` and `PUT /messages`.
