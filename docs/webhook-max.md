# MAX webhook: формат, обработка, проверка

## Найденные проблемы (до правок)

1. **`POST /webhook/max` был заглушкой** — всегда `{ ok: true }`, без разбора `Update`, без вызова API.
2. **Нет проверки подлинности** — при настройке `secret` в подписке MAX платформа шлёт заголовок **`X-Max-Bot-Api-Secret`**; без проверки любой мог слать фиктивные события.
3. **Нет диагностических логов** — невозможно было увидеть реальный JSON от MAX на сервере.
4. **Бот ходил в API только на `http://localhost:${API_PORT}`** — в Docker/отдельных контейнерах `localhost` — это контейнер бота, не API. Добавлена переменная **`API_INTERNAL_BASE_URL`** (URL HTTP API из процесса бота).
5. **Дублирующий webhook после `PostPublisherService.publishPost`** — повторная регистрация того же `(chatId, messageId)` ломала бы `create`. В API **`POST /api/internal/posts/register`** без `postId` переведён на **`upsert`** по паре чат + `maxMessageId`.

## Формат webhook MAX (официально)

Источник: [Подписка на обновления](https://dev.max.ru/docs-api/methods/POST/subscriptions), объект [Update](https://dev.max.ru/docs-api/objects/Update).

- Доставка: **HTTPS POST** на ваш URL, тело — JSON **одного объекта `Update`**.
- Тип события: поле **`update_type`** (например `message_created`, `bot_started`).
- Для **`message_created`**: вложенный объект **`message`** (см. [Message](https://dev.max.ru/docs-api/objects/Message)) — новое сообщение в чате/канале.
- Секрет: если при `POST /subscriptions` передан **`secret`**, каждый webhook содержит заголовок **`X-Max-Bot-Api-Secret`** с этим значением. Нужно сравнить с **`MAX_WEBHOOK_SECRET`** в окружении бота (рекомендуется в production).

### Пример структуры (по документации, поля `message` упрощены)

```json
{
  "update_type": "message_created",
  "timestamp": 1710000000000,
  "message": {
    "sender": { "user_id": 111, "first_name": "Ann", "is_bot": false },
    "recipient": { "chat_id": -1001234567890 },
    "timestamp": 1710000000000,
    "body": { "text": "Текст поста" },
    "url": "https://…"
  }
}
```

Также поддерживается форма с **`message.chat.id`** и текстом на корне сообщения (как в части webhook’ов MAX):

```json
{
  "update_type": "message_created",
  "message": {
    "message_id": "123",
    "chat": { "id": "456" },
    "text": "test"
  }
}
```

Реальные имена полей могут отличаться (`recipient.chat`, `mid` в `body`, и т.д.). Экстракторы в **`apps/bot/src/max-webhook-payload.ts`**; при неудаче — лог **`message_created_skipped`** и `messageSample`.

### Какие события ожидать

| Сценарий | Типичное событие | Действие бота в MVP |
|----------|------------------|---------------------|
| Пользователь открыл чат с ботом / старт | `bot_started` | Только лог; пост не регистрируется. |
| Новое сообщение в группе/канале, где бот админ | `message_created` | Извлечь `chatId` + `messageId` → **`POST /api/internal/posts/register`** → **`POST /api/internal/posts/:id/sync-button`** (через API → бот **`/internal/sync-button`** → `editMessageReplyMarkup`). |
| Другие `update_type` | любые | **200 OK**, в логах **`unsupported_update`** с телом (не глотаем молча). |

Чтобы получать события из **группы/канала**, бота нужно назначить **администратором** (см. доку MAX к объекту Update).

## Когда появляется кнопка «Обсудить»

1. **Публикация через ваш `PostPublisherService`** (`POST …/internal/publish` или аналог): сообщение уходит в MAX уже с **`open_app`** в `sendMessage` — кнопка есть сразу; затем вызывается **register** для связи `postId` ↔ `chatId`/`messageId`.
2. **Пост создан в канале/чате без вашего `sendMessage`** (например админ написал пост): приходит **`message_created`**. Бот вызывает **register** (создаётся внутренний `postId`) и **sync-button**: API дергает бот **`editMessageReplyMarkup`**, чтобы добавить/обновить кнопку с `start_param=post_<uuid>`.

Если webhook **не настроен** на правильный URL в кабинете MAX, события **не придут** — кнопка по событию не появится; нужен либо корректный webhook, либо сценарий **publish** через ваш бот.

### Точный URL webhook для вашего стенда

Убедитесь, что в настройках бота на платформе MAX указан именно:

**`https://commentbot.volkovyskii.ru/webhook/max`**

(HTTPS, порт 443; самоподписанный сертификат MAX не примет.)

## Переменные окружения (бот)

| Переменная | Назначение |
|------------|------------|
| `API_INTERNAL_BASE_URL` | Базовый URL API для `fetch` из бота, например `http://api:3001` в Docker. По умолчанию `http://127.0.0.1:${API_PORT}`. |
| `MAX_WEBHOOK_SECRET` | Ожидаемое значение заголовка `X-Max-Bot-Api-Secret`. Если не задано — проверка отключена (удобно для локального смока; в prod задайте и совпадающий `secret` в подписке). |
| `BOT_INTERNAL_BASE_URL` | На стороне **API** — URL бота для вызова `/internal/sync-button` (см. `apps/api` env). |

## Ручная проверка (curl)

Замените хосты при необходимости.

### 1) Жив ли бот

```bash
curl -sS "https://commentbot.volkovyskii.ru/healthz"
```

Ожидание: JSON с `"ok":true`.

### 2) Webhook без секрета (проверка логов «unsupported»)

```bash
curl -sS -X POST "https://commentbot.volkovyskii.ru/webhook/max" \
  -H "Content-Type: application/json" \
  -d '{"update_type":"message_created","timestamp":1,"message":{"recipient":{"chat_id":-1},"mid":"test-1","body":{"text":"hello"}}}'
```

Ожидание: **200**, в ответе поля `handled`, при успешном API — `postId` и `syncButton`. В логах бота — блок **`MAX webhook received`** и **`parsed message_created identifiers`**.

### 3) Webhook с секретом

```bash
curl -sS -X POST "https://commentbot.volkovyskii.ru/webhook/max" \
  -H "Content-Type: application/json" \
  -H "X-Max-Bot-Api-Secret: YOUR_SECRET" \
  -d '{}'
```

Если `MAX_WEBHOOK_SECRET` задан на сервере, без заголовка или с неверным значением — **401**.

### 4) Регистрация поста напрямую в API (минуя формат MAX)

```bash
curl -sS -X POST "http://127.0.0.1:3001/api/internal/posts/register" \
  -H "Content-Type: application/json" \
  -d '{"chatId":"smoke-chat-1","messageId":"manual-1","botMessageText":"manual"}'
```

Ожидание: `{"id":"<uuid>"}`.

### 5) Sync-button через API

```bash
curl -sS -X POST "http://127.0.0.1:3001/api/internal/posts/<POST_ID>/sync-button"
```

Ожидание: `{"ok":true}`. В логах бота — вызов **`/internal/sync-button`** и ответ MAX на **`editMessageReplyMarkup`** (если не включён `BOT_MOCK_MAX_API` в development).

### Ошибка `Unexpected token '<'` / HTML вместо JSON

Вызовы MAX Bot API идут на **`MAX_API_BASE_URL`** (путь вида `/bot<token>/editMessageReplyMarkup`). **`MAX_WEBAPP_URL`** используется только внутри JSON кнопки `open_app`, не как `fetch` URL.

Если в логах **`bodyPreview`** начинается с `<html>`, проверьте: **`MAX_API_BASE_URL`** указывает на хост **HTTP API**, а не на сайт мини-приложения или маркетинговую страницу. В логе **`internal sync-button`** смотрите **`maxApiUrlRedacted`** и **`maxApiBaseUrl`**.

## Как снять реальный payload с прод-сервера

1. Задайте **`MAX_WEBHOOK_SECRET`** и тот же `secret` в подписке MAX.
2. Включите уровень логов, чтобы видеть **`webhook: ingress`** (там `bodyPreview` до ~16k символов).
3. Опубликуйте тестовый пост в канале / добавьте бота в группу.
4. Найдите в логах строку **`MAX webhook received`** — скопируйте `bodyPreview` или полный JSON из расширенного логирования.
5. Если в логах **`message_created_skipped`** — пришлите фрагмент `messageSample` и доработайте **`extractChatIdFromMessage` / `extractMessageIdFromMessage`** в `apps/bot/src/max-webhook-payload.ts`.

## Коды ответа webhook

| Код | Когда |
|-----|--------|
| **200** | Событие принято (в т.ч. `ignored` / `skipped`, чтобы MAX не крутил ретраи на «не наш тип»). |
| **400** | Тело не JSON / не разобрать. |
| **401** | Неверный или отсутствующий `X-Max-Bot-Api-Secret` при настроенном `MAX_WEBHOOK_SECRET`. |
| **502** | Не удалось вызвать API **register** (сеть, 4xx/5xx API). MAX повторит доставку. |
