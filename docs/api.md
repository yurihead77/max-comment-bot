# Документация API (MVP)

## Публичное API mini app

- `POST /api/auth/max/init` — проверка `initData`, upsert пользователя/чата; **или** в `NODE_ENV=development` при `DEV_MAX_AUTH_BYPASS=true` принимает `{ "devMock": { "maxUserId", "username?", "chatMaxId?", "startParam?" } }` для локальной разработки (в production запрещено).
- `GET /api/posts/:postId` — метаданные поста, счётчик комментариев, состояние ограничений.
- `GET /api/posts/:postId/comments` — сначала `thread_header` (если есть), затем комментарии по времени; `includeHidden=true` доступен модераторам.
- `POST /api/posts/:postId/comments` — создание собственного комментария, поддерживает optional `replyToCommentId`.
- `PATCH /api/comments/:commentId` — редактирование своего комментария.
- `DELETE /api/comments/:commentId` — мягкое удаление своего комментария.
- `POST /api/uploads/comment-image` — загрузка изображения и возврат метаданных вложения.

### Запрос создания комментария (`POST /api/posts/:postId/comments`)

| Поле | Тип | Обязательно | Примечание |
|------|------|-------------|------------|
| `text` | `string` | да | После trim, `1..MAX_COMMENT_LENGTH`. |
| `attachmentIds` | `string[]` | нет | По умолчанию `[]`, максимум `MAX_ATTACHMENTS_PER_COMMENT`. |
| `replyToCommentId` | `string` | нет | Должен ссылаться на существующий обычный комментарий в том же `postId`. |

### Дополнительные поля Comment DTO

- `kind`: `"comment" | "thread_header"`.
- `systemAuthorName`: channel title-like label for `thread_header`.
- `replyToCommentId`: nullable parent id for flat reply UX.
- `replyPreview`: nullable object (`id`, `authorName`, `textSnippet`, `isDeleted`, `isSystem`).

### Формат ответа списка комментариев (`GET /api/posts/:postId/comments`)

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

Примечания:
- `thread_header` (если есть) всегда возвращается первым элементом.
- Публичная лента исключает `hidden`/`deleted`; модераторы могут передавать `includeHidden=true`.
- `replyPreview.textSnippet` формируется на backend (одна строка, схлопнутые пробелы, обрезка по длине).

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

## Внутреннее API

- `POST /api/internal/posts/register`
- `POST /api/internal/posts/:postId/sync-button`
- `POST /api/internal/posts/:postId/resync`

## Поведенческие ограничения

- Счётчик использует только `active` комментарии с `kind=comment` (системный header исключается).
- `hidden` и `deleted` исключаются из публичной ленты и счётчика.
- Все удаления — мягкие (soft delete).
- Глобальные ограничения блокируют создание комментариев.
- `replyToCommentId` должен ссылаться на существующий обычный комментарий в том же `postId`; reply на чужой пост или системную запись возвращает `400`.

### Поведение internal register + sync (важно для сохранения media в MAX)

- `POST /api/internal/posts/register` делает upsert связки поста и поддерживает один системный `thread_header` на пост.
- `POST /api/internal/posts/:postId/sync-button` запускает sync бота, который сохраняет media attachments в MAX:
  - `GET /messages?message_ids=...`
  - удаление старого `inline_keyboard`
  - merge исходных attachments + новой клавиатуры
  - `PUT /messages` с объединённым payload.
