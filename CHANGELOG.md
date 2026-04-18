# Changelog

## 0.2.0 — 2026-04-17 (MVP-ready / pre-release)

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
