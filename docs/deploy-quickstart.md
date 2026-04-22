# Быстрый деплой (для внешних разработчиков)

Короткий путь к рабочему production-like развёртыванию.

Подробности (роли БД, preflight-режимы, Nginx, варианты PM2/systemd) — в `DEPLOYMENT.md`.

## 1) Что нужно заранее

- Linux-сервер с Node.js 20+, pnpm 10+, PostgreSQL (или Docker для БД) и Nginx.
- Репозиторий склонирован в `/opt/max-comment-bot` (или ваш путь).
- Подготовлены HTTPS-домены для API/бота/статических приложений.

## 2) Обязательные переменные окружения

Используйте один канонический runtime env-источник (например `/opt/max-comment-bot/.env.production`).
Можно начать с шаблона из репозитория: `.env.production.example`.

Минимально необходимые:

- Базовые:
  - `NODE_ENV=production`
  - `DATABASE_URL`
  - `ADMIN_SESSION_SECRET`
- MAX / бот:
  - `MAX_BOT_TOKEN`
  - `MAX_API_BASE_URL=https://platform-api.max.ru`
  - `MAX_WEBAPP_URL`
  - `MAX_OPEN_APP_ID`
  - `MAX_WEBHOOK_SECRET` (recommended)
  - `MAX_WEBHOOK_URL` (for webhook subscribe CLI)
- Связка сервисов:
  - `BOT_INTERNAL_BASE_URL` (API -> bot internal route)
  - `UPLOAD_PUBLIC_BASE_URL` (browser-visible files URL prefix)

Build-time переменные фронтенда:

- `apps/miniapp`: `VITE_API_BASE_URL`
- `apps/admin`: `VITE_API_BASE_URL`

## 3) Подготовка БД и сборка

Из корня репозитория:

```bash
cd /opt/max-comment-bot
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:preflight
pnpm db:deploy
pnpm db:seed
pnpm build
```

Если ошибка авторизации БД (`P1000`) или отсутствует база, используйте раздел БД в `DEPLOYMENT.md`.

## 4) Запуск API и бота

Пример с PM2 и env-файлом:

```bash
pm2 start dist/server.js --name max-api -cwd /opt/max-comment-bot/apps/api --node-args="--env-file=/opt/max-comment-bot/.env.production"
pm2 start dist/index.js --name max-bot -cwd /opt/max-comment-bot/apps/bot --node-args="--env-file=/opt/max-comment-bot/.env.production"
```

Эквивалентные plain-node команды (если env уже экспортирован через systemd/shell):

```bash
cd /opt/max-comment-bot/apps/api && node dist/server.js
cd /opt/max-comment-bot/apps/bot && node dist/index.js
```

## 5) Подписка webhook

После изменения URL/secret у бота (или при первом деплое) выполните:

```bash
cd /opt/max-comment-bot
ENV_FILE=/opt/max-comment-bot/.env.production pnpm webhook:resubscribe
```

## 6) Проверка здоровья сервисов

```bash
curl -sf "http://127.0.0.1:3001/healthz"
curl -sf "http://127.0.0.1:3001/health/db"
curl -sf "http://127.0.0.1:3002/healthz"
```

Если все три проверки успешны, сервисы подняты и БД доступна.

## 7) Smoke после деплоя (рекомендуется)

```bash
pnpm run smoke:functional
```

Ожидаемый результат: `FUNCTIONAL_SMOKE_OK`.

Для staging с реальными webhook/open_app в MAX используйте `docs/staging-checklist.md` и `docs/max-integration-manual.md`.
Если нужны отдельные runtime env на каждый сервис, см. `docs/runtime-env-split-examples.md`.
