# Smoke checklist (MVP)

## Automated (production bundle + processes)

Prerequisites:

- PostgreSQL up; `apps/api/.env` with valid `DATABASE_URL`, `ADMIN_SESSION_SECRET`, `MAX_BOT_TOKEN` (same token as the bot; used to verify mini app initData), seed admin vars, etc.
- `pnpm build` completed (`apps/api/dist/server.js`, `apps/bot/dist/index.js` exist).
- `NODE_ENV=development` and `DEV_MAX_AUTH_BYPASS=true` for dev-mock auth inside the script (set in `apps/api/.env` or export in shell before `node --env-file=...`).

Run:

```bash
pnpm build
pnpm run smoke:functional
```

Expect terminal: `FUNCTIONAL_SMOKE_OK`.

The script:

1. Starts **API** via `node --env-file=... dist/server.js` and **bot** via `node --env-file=... dist/index.js` (child processes load `apps/api/.env`; bot child env includes `BOT_MOCK_MAX_API=true` so MAX is not called).
2. Registers a post (`POST /api/internal/posts/register`).
3. Dev-mock auth → `userId`.
4. CRUD flow: get post, create comment, list, edit own.
5. Admin login (cookie), hide → public list empty, restore, soft-delete via admin.
6. Create second comment, delete own (user).
7. Global restriction create → comment create **403** → revoke.
8. Moderation log non-empty.
9. Upload valid PNG → attach to comment → `GET` static URL → admin comment shows attachment.
10. Upload invalid MIME → **400**; oversize image → **413** (multipart `throwFileSizeLimit`) or **400** (route `file too large`) — verify manually with a file larger than `MAX_IMAGE_SIZE_MB`.
11. `POST /api/internal/posts/:id/sync-button` → **200** (bot mocked).
12. Admin `GET` comment with attachment (cookie).
13. Admin **logout** E2E: `GET /api/admin/auth/me` **200** → `POST /api/admin/auth/logout` → same cookie → `GET /api/admin/auth/me` **401** and `GET /api/admin/moderation-actions` **401** (session removed server-side).

URL join sanity (no HTTP):

```bash
node scripts/verify-upload-public-url.mjs
```

## Manual — MAX integration

- Bot publishes post and creates `Обсудить` `open_app` button.
- `postId` linked to `chatId` + `messageId` via internal register API.
- Mini app opens via `start_param=post_<id>` with real `initData` validation (`DEV_MAX_AUTH_BYPASS` off).

## Manual — mini app (real WebApp)

- Public feed: only `active` comments, oldest → newest.
- Create / edit / delete own comment per env limits.
- Restriction banner for muted/blocked users; list still readable unless you change policy later.

## Manual — admin

- Login / session cookie.
- Comments: filter/list, hide, delete (soft), restore.
- Global restrictions: temporary mute, permanent block, revoke.
- Moderation log entries for moderation + restrictions.

## Manual — counter / sync

- After comment changes affecting visible count, inline button text should update (`Обсудить` / `Обсудить (N)`).
- If MAX call fails, API logs error; `POST .../resync` can retry when bot/MAX is healthy.

## Local dev bypass (optional)

- API: `DEV_MAX_AUTH_BYPASS=true`, `NODE_ENV=development`.
- Mini app: `VITE_DEV_MAX_AUTH=true`, optional `?postId=` or `VITE_DEV_POST_ID`.
- Bot: `BOT_MOCK_MAX_API=true` only for local/CI so `sync-button` does not hit MAX.
