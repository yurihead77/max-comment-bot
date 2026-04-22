# MAX Comment Bot MVP

Приложение добавляет в каналы MAX полноценные обсуждения постов.  
В самих каналах MAX нет встроенной ленты комментариев к публикациям, поэтому этот проект реализует такой слой: подписчики могут открывать обсуждение из кнопки под постом, оставлять комментарии, отвечать друг другу, а модераторы — управлять контентом.

Состав монорепозитория:

- `apps/api` — Fastify + Prisma API (public/admin/internal)
- `apps/bot` — MAX bot integration (publish + sync inline button)
- `apps/miniapp` — user mini app for comments
- `apps/admin` — admin panel for moderation/restrictions
- `packages/shared` — shared types

## Требования

- Node.js 20+ (uses `node --env-file` in examples)
- pnpm 10+
- PostgreSQL reachable from `DATABASE_URL` (quick option: **`docker compose up -d`** in repo root — see **`DEPLOYMENT.md`**)

## Локальный запуск

1. Скопируйте шаблон env из корня и заполните значения:

```bash
cp .env.example .env
```

Для API можно использовать отдельный `apps/api/.env` (рекомендуется для Prisma CLI) или симлинк на корневой `.env`.

2. Установите зависимости и подготовьте Prisma:

```bash
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm db:seed
```

3. **Сборка как в production** (bundled entrypoints, запуск через обычный `node`):

```bash
pnpm build
```

4. **Запустите API** (из `apps/api`, чтобы корректно резолвились `./uploads` и `.env`):

```bash
cd apps/api
node --env-file=.env dist/server.js
```

5. **Запустите бота** (можно использовать тот же env-файл; нужны `BOT_PORT`, `MAX_*` и т.д.):

```bash
cd apps/bot
node --env-file=../api/.env dist/index.js
```

6. **Mini app / admin (Vite dev)** — настройте `VITE_API_BASE_URL` (см. `.env.example`) и dev-mock флаги. Для **production static builds** задавайте `VITE_API_BASE_URL` как публичный URL API в CI, либо оставляйте пустым только если API отдается в **том же origin**, что и статика (см. `DEPLOYMENT.md`). Не полагайтесь на `localhost` в браузере пользователей.

```bash
cp apps/miniapp/.env.example apps/miniapp/.env
cp apps/admin/.env.example apps/admin/.env
pnpm --filter @max-comment-bot/miniapp dev
pnpm --filter @max-comment-bot/admin dev
```

### Dev bypass для MAX (только локально)

В `apps/api/.env`:

- `NODE_ENV=development`
- `DEV_MAX_AUTH_BYPASS=true` — разрешает `POST /api/auth/max/init` с JSON `{ "devMock": { ... } }` вместо реального `initData`.

В `apps/miniapp/.env`:

- `VITE_DEV_MAX_AUTH=true` — mini app использует dev-mock auth и может открываться с `?postId=<uuid>` или `VITE_DEV_POST_ID`.

**Production guard:** если в `.env` одновременно `NODE_ENV=production` и `DEV_MAX_AUTH_BYPASS=true`, процесс API **не стартует** (ошибка валидации Zod). В коде dev-mock разрешён только при `NODE_ENV === "development"`.

**Никогда** не включайте `DEV_MAX_AUTH_BYPASS` в production.

### Бот: пропуск реального MAX при sync (только local/CI)

В `apps/api/.env` (бот читает тот же файл при старте с `--env-file=../api/.env`):

- `BOT_MOCK_MAX_API=true` — в **development** `/internal/sync-button` у бота возвращает успех без вызова MAX.

В реальном deployment значение должно быть `false`.

## Команды Turborepo

```bash
pnpm dev          # parallel dev (tsx / vite)
pnpm run typecheck
pnpm run build
```

## Быстрый деплой (для внешних разработчиков)

Минимальный bootstrap сервера (после клонирования в `/opt/max-comment-bot`):

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:preflight
pnpm db:deploy
pnpm db:seed
pnpm build
```

Запуск процессов (пример с PM2 и env-файлом):

```bash
pm2 start dist/server.js --name max-api -cwd /opt/max-comment-bot/apps/api --node-args="--env-file=/opt/max-comment-bot/.env.production"
pm2 start dist/index.js --name max-bot -cwd /opt/max-comment-bot/apps/bot --node-args="--env-file=/opt/max-comment-bot/.env.production"
```

Проверьте сервисы:

```bash
curl -sf "http://127.0.0.1:3001/healthz"
curl -sf "http://127.0.0.1:3001/health/db"
curl -sf "http://127.0.0.1:3002/healthz"
ENV_FILE=/opt/max-comment-bot/.env.production pnpm webhook:resubscribe
```

Подробная production-документация (Nginx, роли БД, preflight, источники env): `DEPLOYMENT.md`.  
Короткий one-pager для онбординга: `docs/deploy-quickstart.md`.  
Шаблон runtime env для серверов: `.env.production.example`.  
Раздельные env-примеры для API/бота (systemd/PM2): `docs/runtime-env-split-examples.md`.

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

## Ограничения MVP

- Плоский список комментариев (без вложенных тредов), с превью ответа (`replyToCommentId` + `replyPreview`) внутри bubble.
- Для каждого поста создаётся системный заголовок обсуждения (`kind=thread_header`) — идемпотентно, один раз на пост.
- В публичной ленте отображаются только `active` комментарии.
- Порядок выдачи: сначала thread header, затем комментарии по времени.
- Удаление — мягкое (`status=deleted`).
- Ограничения пользователей в MVP глобальные.
- Модератор может скрывать/удалять/восстанавливать комментарии (без редактирования текста).
- Пользователь может редактировать/удалять только свои комментарии (по env-настройкам).
- `sync-button` использует безопасный merge в MAX: `GET /messages?message_ids=...` → сохраняем текст и media attachments → заменяем только `inline_keyboard` → `PUT /messages`.
