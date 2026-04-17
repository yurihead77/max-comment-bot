# API Documentation (MVP)

## Public mini app API

- `POST /api/auth/max/init` — validate `initData`, upsert user/chat; **or** in `NODE_ENV=development` with `DEV_MAX_AUTH_BYPASS=true`, accept `{ "devMock": { "maxUserId", "username?", "chatMaxId?", "startParam?" } }` for local testing (never enable in production).
- `GET /api/posts/:postId` — post meta + comments count + restriction state.
- `GET /api/posts/:postId/comments` — active comments only, oldest first.
- `POST /api/posts/:postId/comments` — create own comment.
- `PATCH /api/comments/:commentId` — edit own comment.
- `DELETE /api/comments/:commentId` — soft delete own comment.
- `POST /api/uploads/comment-image` — upload image and return attachment metadata.

## Admin API

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/auth/me`
- `GET /api/admin/comments`
- `GET /api/admin/comments/:commentId`
- `PATCH /api/admin/comments/:commentId` (`hide|unhide|delete|restore`)
- `GET /api/admin/restrictions`
- `POST /api/admin/restrictions`
- `PATCH /api/admin/restrictions/:restrictionId`
- `POST /api/admin/restrictions/:restrictionId/revoke`
- `GET /api/admin/moderation-actions`

## Internal API

- `POST /api/internal/posts/register`
- `POST /api/internal/posts/:postId/sync-button`
- `POST /api/internal/posts/:postId/resync`

## Behavior constraints

- Counter uses only `active` comments.
- `hidden` and `deleted` are excluded from public feed and counter.
- All deletes are soft deletes.
- Global restrictions block comment creation.
