# Smoke-чеклист (MVP)

## Автоматическая проверка (production bundle + процессы)

Предусловия:

- PostgreSQL поднят; `apps/api/.env` содержит корректный `DATABASE_URL` (рекомендуется роль `commentbot` — см. `DEPLOYMENT.md`), `ADMIN_SESSION_SECRET`, `MAX_BOT_TOKEN` (тот же токен, что у бота; нужен для проверки mini app initData), seed admin-параметры и т.д.
- Выполнена `pnpm build` (`apps/api/dist/server.js`, `apps/bot/dist/index.js` существуют).
- Для dev-mock auth внутри скрипта: `NODE_ENV=development` и `DEV_MAX_AUTH_BYPASS=true` (в `apps/api/.env` или через export перед `node --env-file=...`).

Запуск:

```bash
pnpm build
pnpm run smoke:functional
```

Ожидаемый результат в консоли: `FUNCTIONAL_SMOKE_OK`.

Сценарий скрипта:

1. Поднимает **API** через `node --env-file=... dist/server.js` и **бота** через `node --env-file=... dist/index.js` (дочерние процессы читают `apps/api/.env`; для бота включается `BOT_MOCK_MAX_API=true`, поэтому MAX не вызывается).
2. Регистрирует пост (`POST /api/internal/posts/register`).
3. Выполняет dev-mock auth → `userId`.
4. Проверяет CRUD-цепочку: get post, create comment, list, edit own.
5. Логин в admin (cookie), hide → публичный список пуст, restore, soft-delete через admin.
6. Создаёт второй комментарий, удаляет его как пользователь.
7. Создаёт глобальное ограничение → create comment даёт **403** → revoke.
8. Проверяет, что moderation log не пуст.
9. Загружает корректный PNG → привязывает к комментарию → `GET` статического URL → вложение видно в admin-комментарии.
10. Невалидный MIME → **400**; слишком большой файл → **413** (multipart `throwFileSizeLimit`) или **400** (route `file too large`) — дополнительно проверьте вручную на файле больше `MAX_IMAGE_SIZE_MB`.
11. `POST /api/internal/posts/:id/sync-button` → **200** (при mocked bot).
12. Admin `GET` комментария с вложением (cookie).
13. E2E logout в admin: `GET /api/admin/auth/me` **200** → `POST /api/admin/auth/logout` → с тем же cookie `GET /api/admin/auth/me` **401** и `GET /api/admin/moderation-actions` **401** (сессия удалена на сервере).

Проверка join URL (без HTTP):

```bash
node scripts/verify-upload-public-url.mjs
```

## Ручная проверка — интеграция с MAX

- Бот публикует пост и создаёт кнопку `Обсудить` типа `open_app`.
- `postId` связан с `chatId` + `messageId` через internal register API.
- Mini app открывается через `start_param=post_<id>` с реальной валидацией `initData` (`DEV_MAX_AUTH_BYPASS` выключен).

## Ручная проверка — mini app (реальный WebApp)

- Публичная лента: только `active` комментарии, от старых к новым.
- Создание / редактирование / удаление своего комментария по env-лимитам.
- Restriction banner для mute/block пользователей; лента остаётся читаемой (если политика не менялась).
- Reply UX (flat list):
  - Create comment A, then reply comment B to A via `Ответить`; B shows compact quote (`authorName` + one-line `textSnippet`).
  - Click quote in B: list scrolls to A and briefly highlights A.
  - Delete A (or hide via moderator): B still renders reply quote with safe fallback (`Сообщение удалено` / `Комментарий скрыт`), no crash.
  - Try reply to a comment from another `postId` via API payload: backend returns `400`.
  - Try reply to `thread_header` via API payload: backend returns `400` (reply target must be regular comment).

## Ручная проверка — admin

- Логин / session cookie.
- Комментарии: filter/list, hide, delete (soft), restore.
- Глобальные ограничения: temporary mute, permanent block, revoke.
- Наличие записей moderation log для модерации и ограничений.

## Ручная проверка — счётчик / sync

- После изменений комментариев, влияющих на счётчик, текст inline-кнопки обновляется (`Обсудить` / `Обсудить (N)`).
- При ошибке вызова MAX API пишет ошибку в логи; `POST .../resync` можно использовать для повтора после восстановления bot/MAX.

## Local dev bypass (опционально)

- API: `DEV_MAX_AUTH_BYPASS=true`, `NODE_ENV=development`.
- Mini app: `VITE_DEV_MAX_AUTH=true`, опционально `?postId=` или `VITE_DEV_POST_ID`.
- Бот: `BOT_MOCK_MAX_API=true` только для local/CI, чтобы `sync-button` не вызывал MAX.
