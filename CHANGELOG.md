# Changelog

## 0.2.1 — 2026-04-22 (discussion UX + MAX sync safety)

### Discussion thread UX

- Added idempotent system thread header (`Comment.kind=thread_header`) created during internal post register, using post text + channel title (with fallback and truncation).
- Added flat reply support with `replyToCommentId` and server-side `replyPreview` (`authorName`, one-line `textSnippet`, `isDeleted`, `isSystem`).
- Mini app renders reply preview inside message bubble (Telegram-like), keeps jump-to-comment + transient highlight behavior.

### Safety and moderation constraints

- `replyToCommentId` validation: must exist, belong to same `postId`, and target a regular comment (not system header); invalid targets return `400`.
- System header is protected from user/admin edit/delete/report/moderation flows.
- Post comments counter excludes system entries (`kind=comment` only).

### MAX sync-button

- Fixed media-loss bug on `PUT /messages`: sync now fetches current message via `GET /messages?message_ids=...`, preserves text and media attachments, replaces only `inline_keyboard`, then sends merged payload.
- Added merge diagnostics (attachment counts/types before/after) in sync-button logs.

## 0.2.0 — 2026-04-17 (MVP-ready / pre-release)

### MAX Bot API (platform-api)

- **`MaxClient`**: вместо несуществующих путей `/bot<token>/sendMessage` и `editMessageReplyMarkup` используются официальные **`POST /messages?chat_id=…`** и **`PUT /messages?message_id=…`** на **`MAX_API_BASE_URL`** (по умолчанию `https://platform-api.max.ru`), заголовок **`Authorization: <token>`**, query **`v=MAX_API_VERSION`**, тело с **`attachments` / `inline_keyboard` / `open_app`** (`web_app` + `payload` как в [max-bot-api-client-go](https://github.com/max-messenger/max-bot-api-client-go)).

### Webhook MAX (bot)

- Реальная обработка **`POST /webhook/max`**: `message_created` → register → sync-button; `bot_started` / прочие типы логируются.
- Заголовок **`X-Max-Bot-Api-Secret`** при заданном **`MAX_WEBHOOK_SECRET`**; подробные логи ingress.
- **`GET /healthz`** на боте; **`API_INTERNAL_BASE_URL`** для вызовов API из бота.
- **`POST /api/internal/posts/register`** без `postId`: **upsert** по `(chatId, maxMessageId)`.
- Документация: [docs/webhook-max.md](docs/webhook-max.md).

- Admin **logout** invalidates the session in the database and clears the cookie, so replaying the old `Cookie` header no longer authenticates.
- **DEPLOYMENT.md**: documents that `pnpm run start:prod` is plain `node dist/...` with **no** `--env-file`; env must come from systemd `EnvironmentFile`, shell exports, PM2 `env` / `--env-file`, Docker `env` / `env_file`, etc.
- **docs/staging-checklist.md**: real-MAX staging steps (HTTPS webhook, publish, `open_app`, mini app auth, comment, sync button, uploads URL checks).
- **scripts/verify-upload-public-url.mjs** and `buildUploadPublicFileUrl` helper: consistent public upload URLs without doubled path slashes.
- **smoke:functional**: bot child process forces `NODE_ENV=development` alongside `BOT_MOCK_MAX_API=true` so an `apps/api/.env` with `NODE_ENV=production` (from `node --env-file=...` on the smoke runner) does not make the bot exit immediately.
