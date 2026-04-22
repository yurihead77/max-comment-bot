# API Documentation (MVP)

## Public mini app API

- `POST /api/auth/max/init` — validate `initData`, upsert user/chat; **or** in `NODE_ENV=development` with `DEV_MAX_AUTH_BYPASS=true`, accept `{ "devMock": { "maxUserId", "username?", "chatMaxId?", "startParam?" } }` for local testing (never enable in production).
- `GET /api/posts/:postId` — post meta + comments count + restriction state.
- `GET /api/posts/:postId/comments` — returns `thread_header` first (if exists), then comments oldest first; supports `includeHidden=true` for moderators.
- `POST /api/posts/:postId/comments` — create own comment, supports optional `replyToCommentId`.
- `PATCH /api/comments/:commentId` — edit own comment.
- `DELETE /api/comments/:commentId` — soft delete own comment.
- `POST /api/uploads/comment-image` — upload image and return attachment metadata.

### Create comment request (`POST /api/posts/:postId/comments`)

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `text` | `string` | yes | Trimmed, `1..MAX_COMMENT_LENGTH`. |
| `attachmentIds` | `string[]` | no | Defaults to `[]`, max `MAX_ATTACHMENTS_PER_COMMENT`. |
| `replyToCommentId` | `string` | no | Must reference an existing regular comment in the same `postId`. |

### Comment DTO additions

- `kind`: `"comment" | "thread_header"`.
- `systemAuthorName`: channel title-like label for `thread_header`.
- `replyToCommentId`: nullable parent id for flat reply UX.
- `replyPreview`: nullable object (`id`, `authorName`, `textSnippet`, `isDeleted`, `isSystem`).

### List comments response shape (`GET /api/posts/:postId/comments`)

```json
{
  "items": [
    {
      "id": "cmt_...",
      "postId": "post_...",
      "authorId": "usr_...",
      "kind": "comment",
      "systemAuthorName": null,
      "replyToCommentId": "cmt_parent_...",
      "replyPreview": {
        "id": "cmt_parent_...",
        "authorName": "Юрий",
        "textSnippet": "Одна короткая строка...",
        "isDeleted": false,
        "isSystem": false
      },
      "text": "Текст комментария",
      "status": "active",
      "createdAt": "2026-04-22T10:11:12.000Z",
      "isEdited": false,
      "author": {
        "id": "usr_...",
        "maxUserId": "900001",
        "username": "localdev",
        "firstName": "Yuri",
        "lastName": null,
        "photoUrl": null
      }
    }
  ]
}
```

Notes:
- `thread_header` (if exists) is returned as the first item.
- Public feed excludes `hidden`/`deleted`; moderators may pass `includeHidden=true`.
- `replyPreview.textSnippet` is generated on backend (single line, collapsed spaces, truncated).

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

- Counter uses only `active` comments with `kind=comment` (system header is excluded).
- `hidden` and `deleted` are excluded from public feed and counter.
- All deletes are soft deletes.
- Global restrictions block comment creation.
- `replyToCommentId` must point to an existing regular comment in the same `postId`; cross-post or system targets return `400`.

### Internal register + sync behavior (important for MAX media safety)

- `POST /api/internal/posts/register` upserts post binding and maintains one system `thread_header` per post.
- `POST /api/internal/posts/:postId/sync-button` triggers bot sync that preserves media attachments on MAX:
  - `GET /messages?message_ids=...`
  - remove old `inline_keyboard` attachment
  - merge original attachments + new keyboard
  - `PUT /messages` with merged payload.
