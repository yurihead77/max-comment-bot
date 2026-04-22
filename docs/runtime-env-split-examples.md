# Примеры раздельного runtime env (API / Bot)

Используйте этот вариант, если не хотите хранить один общий env-файл для API и бота.

Базовый шаблон переменных: `.env.production.example`.

## Вариант A: systemd с отдельными EnvironmentFile

### `/etc/max-comment-bot/api.env` (только API)

```bash
NODE_ENV=production
TRUST_PROXY=true
API_PORT=3001

DATABASE_URL=postgresql://commentbot:CHANGE_ME@127.0.0.1:5432/comments?schema=public
# DATABASE_PREFLIGHT_ADMIN_URL=postgresql://postgres:CHANGE_ME@127.0.0.1:5432/postgres?schema=public

BOT_INTERNAL_BASE_URL=http://127.0.0.1:3002
UPLOAD_DIR=./uploads
UPLOAD_PUBLIC_BASE_URL=https://api.example.com/uploads
ALLOWED_IMAGE_MIME_TYPES=image/jpeg,image/png,image/webp

MAX_BOT_TOKEN=CHANGE_ME
MAX_COMMENT_LENGTH=2000
MAX_ATTACHMENTS_PER_COMMENT=4
MAX_IMAGE_SIZE_MB=10
COMMENT_EDIT_WINDOW_MINUTES=0
USER_CAN_DELETE_OWN_COMMENT=true
COMMENT_COOLDOWN_SECONDS=10
COMMENT_RATE_LIMIT_WINDOW_SECONDS=60
COMMENT_RATE_LIMIT_MAX=5

ADMIN_SESSION_SECRET=CHANGE_ME
ADMIN_SESSION_TTL_SECONDS=86400
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=ChangeMe123!

DEV_MAX_AUTH_BYPASS=false
BOT_MOCK_MAX_API=false
```

### `/etc/max-comment-bot/bot.env` (только бот)

```bash
NODE_ENV=production
BOT_PORT=3002

MAX_BOT_TOKEN=CHANGE_ME
MAX_API_BASE_URL=https://platform-api.max.ru
# MAX_API_VERSION=1.2.5
MAX_WEBHOOK_SECRET=CHANGE_ME
MAX_WEBHOOK_URL=https://commentbot.example.com/webhook/max
MAX_WEBAPP_URL=https://example.com/miniapp
MAX_OPEN_APP_ID=CHANGE_ME
# MAX_OPEN_APP_CONTACT_ID=123456789

API_INTERNAL_BASE_URL=http://127.0.0.1:3001
BOT_MOCK_MAX_API=false
DEV_MAX_AUTH_BYPASS=false
```

### Фрагменты systemd unit

`/etc/systemd/system/max-api.service`:

```ini
[Service]
WorkingDirectory=/opt/max-comment-bot/apps/api
EnvironmentFile=/etc/max-comment-bot/api.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
```

`/etc/systemd/system/max-bot.service`:

```ini
[Service]
WorkingDirectory=/opt/max-comment-bot/apps/bot
EnvironmentFile=/etc/max-comment-bot/bot.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
```

## Вариант B: PM2 ecosystem с раздельными env

Создайте `ecosystem.config.cjs`:

```js
module.exports = {
  apps: [
    {
      name: "max-api",
      cwd: "/opt/max-comment-bot/apps/api",
      script: "dist/server.js",
      env: {
        NODE_ENV: "production",
        TRUST_PROXY: "true",
        API_PORT: "3001",
        DATABASE_URL: "postgresql://commentbot:CHANGE_ME@127.0.0.1:5432/comments?schema=public",
        BOT_INTERNAL_BASE_URL: "http://127.0.0.1:3002",
        UPLOAD_DIR: "./uploads",
        UPLOAD_PUBLIC_BASE_URL: "https://api.example.com/uploads",
        MAX_BOT_TOKEN: "CHANGE_ME",
        ADMIN_SESSION_SECRET: "CHANGE_ME",
        ADMIN_SESSION_TTL_SECONDS: "86400",
        SEED_ADMIN_EMAIL: "admin@example.com",
        SEED_ADMIN_PASSWORD: "ChangeMe123!",
        DEV_MAX_AUTH_BYPASS: "false",
        BOT_MOCK_MAX_API: "false"
      }
    },
    {
      name: "max-bot",
      cwd: "/opt/max-comment-bot/apps/bot",
      script: "dist/index.js",
      env: {
        NODE_ENV: "production",
        BOT_PORT: "3002",
        MAX_BOT_TOKEN: "CHANGE_ME",
        MAX_API_BASE_URL: "https://platform-api.max.ru",
        MAX_WEBHOOK_SECRET: "CHANGE_ME",
        MAX_WEBHOOK_URL: "https://commentbot.example.com/webhook/max",
        MAX_WEBAPP_URL: "https://example.com/miniapp",
        MAX_OPEN_APP_ID: "CHANGE_ME",
        API_INTERNAL_BASE_URL: "http://127.0.0.1:3001",
        BOT_MOCK_MAX_API: "false",
        DEV_MAX_AUTH_BYPASS: "false"
      }
    }
  ]
};
```

Запуск:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

## Финальные проверки

```bash
curl -sf "http://127.0.0.1:3001/healthz"
curl -sf "http://127.0.0.1:3001/health/db"
curl -sf "http://127.0.0.1:3002/healthz"
```

Затем (из корня репозитория):

```bash
ENV_FILE=/etc/max-comment-bot/bot.env pnpm webhook:resubscribe
```
