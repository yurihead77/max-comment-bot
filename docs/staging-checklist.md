# Staging checklist (real MAX)

Use a **staging** bot token, HTTPS webhook URL, and staging DB. Turn off dev bypasses: `NODE_ENV=production`, `DEV_MAX_AUTH_BYPASS` unset/false, `BOT_MOCK_MAX_API` unset/false.

Cross-reference: [max-integration-manual.md](max-integration-manual.md) for webhook URL, env, and Nginx.

## 1. Webhook (HTTPS)

- [ ] MAX developer console: webhook URL is **HTTPS** and points to your bot service (e.g. `https://bot.staging.example/webhook/max`).
- [ ] Bot process reachable from the internet; TLS terminates at Nginx (or load balancer).
- [ ] Optional: secret header / IP restrictions as in production policy.

## 2. Publish post

- [ ] Publish a test post through MAX so the bot receives the event (or your chosen flow registers the post).
- [ ] API has `POST /api/internal/posts/register` (or equivalent automation) linking `chatId` + `messageId` to `postId`.

## 3. Inline button (`open_app`)

- [ ] Post shows **«Обсудить»** (or **«Обсудить (N)»**) with `open_app` / mini app deep link and `start_param=post_<uuid>`.

## 4. Auth inside mini app

- [ ] Open mini app from MAX; `initData` is sent to `POST /api/auth/max/init` (no dev-mock).
- [ ] Session / `userId` works; feed loads for that `postId`.

## 5. Create comment

- [ ] Create a comment with text (and optional image if uploads are enabled).
- [ ] Comment appears in the public list for other users viewing the same post (if applicable).
- [ ] Discussion opens with system header (`thread_header`) first, then user comments.
- [ ] Reply flow: create reply to an existing comment, quoted preview appears inside bubble, click quote scrolls/highlights target.
- [ ] Reply safety: hidden/deleted parent comment still renders safe preview text without UI errors.

## 6. Sync button update

- [ ] After a change that affects the visible comment count, **«Обсудить (N)»** updates (bot `sync-button` path healthy, MAX API credentials OK).
- [ ] If the count is wrong, use resync flow from ops docs when bot/MAX is healthy.

## 7. Admin (staging)

- [ ] Admin UI over HTTPS; login with seeded admin.
- [ ] Logout: after **Logout**, protected API calls return **401** (session invalidated server-side and cookie cleared).

## 8. Upload URL shape (manual)

- [ ] Set `UPLOAD_PUBLIC_BASE_URL` to `https://<host>/uploads` (no trailing slash), upload an image, confirm stored URL is `https://<host>/uploads/<filename>` with **no** `//` in the path.
- [ ] Repeat with a **path prefix**, e.g. `https://<host>/api/staging/uploads`, same check.

Automated mirror of the URL join logic (no HTTP):

```bash
node scripts/verify-upload-public-url.mjs
```

Expect: `UPLOAD_PUBLIC_URL_OK`.
