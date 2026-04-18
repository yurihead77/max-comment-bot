# MAX webhook: формат, обработка, проверка

## Мини-приложение ≠ webhook URL

В кабинете MAX для **мини-приложения** задаётся URL **открытия Web App** (то же значение, что у вас в **`MAX_WEBAPP_URL`** для кнопки `open_app`). Этот URL **не** подставляется платформой как endpoint для **Bot API webhook**.

Доставка событий (`message_created`, `bot_started`, …) на ваш сервер настраивается **только** через Bot API:

1. **`POST https://platform-api.max.ru/subscriptions?v=<версия>`** — зарегистрировать HTTPS URL (порт **443**), список **`update_types`**, опционально **`secret`** (тогда MAX шлёт **`X-Max-Bot-Api-Secret`**).
2. **`GET …/subscriptions`** — посмотреть активные подписки.
3. **`DELETE …/subscriptions?url=<url>`** — отписать конкретный URL.

Заголовок **`Authorization: <MAX_BOT_TOKEN>`** (как для **`POST /messages`**), тело — JSON при `POST`.

В репозитории это автоматизировано скриптами (**`MAX_BOT_TOKEN`**, **`MAX_API_BASE_URL`**, при subscribe — **`MAX_WEBHOOK_URL`**).

### Переменные для CLI и `.env.production`

Процесс бота в production часто стартуют с **`--env-file=/opt/max-comment-bot/.env.production`** (PM2 и т.п.), тогда **`pnpm webhook:*`** должен видеть **те же** переменные.

По умолчанию CLI читает и **мерджит** (поздний файл перекрывает ранний) три пути **относительно корня репозитория**:

1. **`apps/bot/.env`**
2. **`.env`**
3. **`.env.production`** — итоговые production-значения не теряются: ключи из этого файла побеждают при конфликте.

На сервере при деплое в **`/opt/max-comment-bot`** это эквивалентно цепочке  
`/opt/max-comment-bot/apps/bot/.env` → **`/opt/max-comment-bot/.env`** → **`/opt/max-comment-bot/.env.production`**.

Явный файл (без merge), как у PM2:

```bash
ENV_FILE=/opt/max-comment-bot/.env.production pnpm webhook:list
```

Или подгрузить production в shell и вызвать pnpm (переменные попадут в дочерний процесс):

```bash
cd /opt/max-comment-bot
set -a && source /opt/max-comment-bot/.env.production && set +a
pnpm webhook:list
pnpm webhook:resubscribe
```

Если **`MAX_BOT_TOKEN`** не найден, CLI выведет список путей, с которых пытались читать env.

```bash
pnpm webhook:list
pnpm webhook:subscribe
pnpm webhook:unsubscribe
pnpm webhook:resubscribe
```

Реализация: **`apps/bot/src/max-subscriptions.ts`**, CLI: **`apps/bot/scripts/max-webhook-subscriptions.ts`**. После деплоя достаточно **`pnpm webhook:resubscribe`** (или **`subscribe`**, если подписки ещё не было), с тем же env, что у работающего бота.

### Эквивалент curl (как у скриптов)

Подставьте токен и URL; для **`v`** используйте то же, что в **`MAX_API_VERSION`** (по умолчанию **1.2.5**).

```bash
export MAX_BOT_TOKEN="…"
export V="${MAX_API_VERSION:-1.2.5}"
export BASE="${MAX_API_BASE_URL:-https://platform-api.max.ru}"

curl -sS "$BASE/subscriptions?v=$V" -H "Authorization: $MAX_BOT_TOKEN"
```

```bash
curl -sS -X POST "$BASE/subscriptions?v=$V" \
  -H "Authorization: $MAX_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://commentbot.volkovyskii.ru/webhook/max\",\"update_types\":[\"message_created\",\"bot_started\"],\"secret\":\"${MAX_WEBHOOK_SECRET}\"}"
```

Если **`secret`** не нужен, удалите поле **`secret`** из JSON.

```bash
WEBHOOK_URL="https://commentbot.volkovyskii.ru/webhook/max"
curl -sS -G -X DELETE "$BASE/subscriptions" \
  --data-urlencode "v=$V" \
  --data-urlencode "url=$WEBHOOK_URL" \
  -H "Authorization: $MAX_BOT_TOKEN"
```

Проверка: после **`subscribe`** в **`pnpm webhook:list`** должен появиться ваш URL; в **`update_types`** обязательно должны быть **`message_created`** (и при необходимости **`bot_started`** — так же задаётся в коде **`DEFAULT_WEBHOOK_UPDATE_TYPES`**).

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

Идентификатор для **`PUT /messages?message_id=…`** в MAX совпадает с **`Message.body.mid`** (часто дублируется как **`mid`** на корне `message`). Экстрактор **`extractMessageIdFromMessage`** сначала берёт **`body.mid`**, затем fallbacks (`mid`, `message_id`, …), чтобы тестовый **`message_id": "123"`** не перекрывал реальный **`body.mid`**.

Пример с **`body.mid`** (ближе к прод-ответу MAX):

```json
{
  "update_type": "message_created",
  "message": {
    "chat": { "id": "456" },
    "body": { "mid": "<реальный-id-из-MAX>", "text": "test" }
  }
}
```

Реальные имена полей могут отличаться (`recipient.chat`, и т.д.). Экстракторы в **`apps/bot/src/max-webhook-payload.ts`**; при неудаче — лог **`message_created_skipped`** и `messageSample`.

### Какие события ожидать

| Сценарий | Типичное событие | Действие бота в MVP |
|----------|------------------|---------------------|
| Пользователь открыл чат с ботом / старт | `bot_started` | Только лог; пост не регистрируется. |
| Новое сообщение в группе/канале, где бот админ | `message_created` | Извлечь `chatId` + `messageId` → **`POST /api/internal/posts/register`** → **`POST /api/internal/posts/:id/sync-button`** (через API → бот **`/internal/sync-button`** → MAX **`PUT /messages`** с `inline_keyboard` / `open_app`). |
| Другие `update_type` | любые | **200 OK**, в логах **`unsupported_update`** с телом (не глотаем молча). |

Чтобы получать события из **группы/канала**, бота нужно назначить **администратором** (см. доку MAX к объекту Update).

## Когда появляется кнопка «Обсудить»

1. **Публикация через ваш `PostPublisherService`** (`POST …/internal/publish` или аналог): сообщение уходит в MAX через официальный **`POST /messages`** с вложением **`inline_keyboard`** / **`open_app`** — кнопка есть сразу; затем вызывается **register** для связи `postId` ↔ `chatId`/`messageId`.
2. **Пост создан в канале/чате без вашего `sendMessage`** (например админ написал пост): приходит **`message_created`**. Бот вызывает **register** (создаётся внутренний `postId`) и **sync-button**: бот дергает MAX **`PUT /messages?message_id=…`** с новой клавиатурой (`start_param` в поле `payload` кнопки `open_app`).

Если подписка **`POST /subscriptions`** не создана или URL неверный, события **не придут** — кнопка по событию не появится; нужен корректный webhook через API или сценарий **publish** через ваш бот.

### Точный URL webhook для вашего стенда

Зарегистрируйте через **`pnpm webhook:subscribe`** (или curl выше) именно:

**`https://commentbot.volkovyskii.ru/webhook/max`**

Требования MAX: **HTTPS**, порт **443**, валидный сертификат (самоподписанный MAX не примет).

## Переменные окружения (бот)

| Переменная | Назначение |
|------------|------------|
| `API_INTERNAL_BASE_URL` | Базовый URL API для `fetch` из бота, например `http://api:3001` в Docker. По умолчанию `http://127.0.0.1:${API_PORT}`. |
| `MAX_WEBHOOK_SECRET` | Ожидаемое значение заголовка `X-Max-Bot-Api-Secret`. Если не задано — проверка отключена (удобно для локального смока; в prod задайте и совпадающий `secret` в подписке). |
| `MAX_WEBHOOK_URL` | Полный публичный URL **`POST /webhook/max`** для CLI **`pnpm webhook:subscribe`** / **`resubscribe`** (не путать с `MAX_WEBAPP_URL`). |
| `ENV_FILE` | Только для CLI **`pnpm webhook:*`**: абсолютный или относительный (**от `cwd`**) путь к одному env-файлу; при задании merge из репозитория **не** выполняется. |
| `BOT_INTERNAL_BASE_URL` | На стороне **API** — URL бота для вызова `/internal/sync-button` (см. `apps/api` env). |

## Ручная проверка (curl)

Замените хосты при необходимости.

### 1) Жив ли бот

```bash
curl -sS "https://commentbot.volkovyskii.ru/healthz"
```

Ожидание: JSON с `"ok":true`.

### 2) Webhook без секрета (проверка логов)

```bash
curl -sS -X POST "https://commentbot.volkovyskii.ru/webhook/max" \
  -H "Content-Type: application/json" \
  -d '{"update_type":"message_created","timestamp":1,"message":{"recipient":{"chat_id":-1},"body":{"mid":"smoke-webhook-mid-1","text":"hello"}}}'
```

Ожидание: **200**, в ответе `handled`, при успешном API — `postId` и `syncButton`. В логах бота — **`MAX webhook received`**, **`maxPutMessageId`** (то же значение уйдёт в **`PUT /messages`**).

**Важно:** значение вроде **`"123"`** или **`smoke-webhook-mid-1`** не существует в MAX — **`sync-button`** вызовет реальный **`PUT /messages`** и MAX вернёт **400** `Invalid message_id`. Для проверки **успешного** PUT либо скопируйте **`body.mid`** из реального webhook (лог **`bodyPreview`** / **`maxPutMessageId`**), либо сначала опубликуйте пост через **`/internal/publish`** и возьмите **`messageId`** из JSON-ответа (см. п. 6).

### 3) Webhook с секретом

```bash
curl -sS -X POST "https://commentbot.volkovyskii.ru/webhook/max" \
  -H "Content-Type: application/json" \
  -H "X-Max-Bot-Api-Secret: YOUR_SECRET" \
  -d '{}'
```

Если `MAX_WEBHOOK_SECRET` задан на сервере, без заголовка или с неверным значением — **401**.

### 4) Регистрация поста напрямую в API (минуя MAX)

```bash
curl -sS -X POST "http://127.0.0.1:3001/api/internal/posts/register" \
  -H "Content-Type: application/json" \
  -d '{"chatId":"smoke-chat-1","messageId":"manual-1","botMessageText":"manual"}'
```

Ожидание: `{"id":"<uuid>"}`. Поле **`messageId`** здесь — это **`maxMessageId`** в БД; для **живого** MAX оно должно быть **реальным** `mid` из сообщения, иначе шаг 5 даст **502** / в логах бота — **400** от MAX.

### 5) Sync-button через API (нужен реальный `mid` в БД)

```bash
curl -sS -X POST "http://127.0.0.1:3001/api/internal/posts/<POST_ID>/sync-button"
```

Ожидание: `{"ok":true}` только если в посте сохранён существующий в MAX **`message_id`** (= **`body.mid`**). В логах **API** — **`sync-button: POST bot`** с **`maxPutMessageId`**; в логах **бота** — **`/internal/sync-button`** и ответ MAX на **`PUT /messages`**. В development можно включить **`BOT_MOCK_MAX_API=true`**, чтобы не дергать MAX с фиктивным id.

### 6) Полный корректный смок: publish → реальный `messageId` → sync

1. Вызов **`POST`** на бота **`/internal/publish`** с реальным **`chatId`** канала и текстом (как в вашем сценарии деплоя).
2. В ответе возьмите **`messageId`** — это уже id из ответа **`POST /messages`** MAX (тот же, что для **`PUT`**).
3. При необходимости вызовите **`POST …/sync-button`** для того же поста — MAX примет **`message_id`**, если он совпадает с опубликованным сообщением.

### Ошибка `Unexpected token '<'` / HTML вместо JSON

Официальный Bot API MAX: **`https://platform-api.max.ru/messages`** с заголовком **`Authorization: <bot token>`** и query **`v=<версия>`** (см. [dev.max.ru/docs-api](https://dev.max.ru/docs-api)). Путей вида **`/bot<token>/sendMessage`** на этом хосте **нет** — часто отдаётся **404 HTML**. Задайте **`MAX_API_BASE_URL=https://platform-api.max.ru`**. **`MAX_WEBAPP_URL`** — только URL мини-приложения в поле **`web_app`** кнопки, не база для `fetch`.

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
