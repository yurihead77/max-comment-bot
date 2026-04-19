# Ручная интеграция с MAX (production-like)

Автотесты и `smoke-functional.mjs` используют `BOT_MOCK_MAX_API` и не вызывают реальный MAX. Ниже — чеклист для **живой** проверки после выката на сервер с HTTPS, валидными токенами и webhook.

## Предусловия

- `NODE_ENV=production`, `DEV_MAX_AUTH_BYPASS=false`, `BOT_MOCK_MAX_API=false`.
- `MAX_BOT_TOKEN`, `MAX_API_BASE_URL`, `MAX_WEBAPP_URL` — боевые значения.
- Webhook бота на HTTPS URL, доступный из MAX (формат тел, секрет, curl: [webhook-max.md](webhook-max.md)).
- API и бот запущены (`start:prod`), БД с миграциями и seed.

### `MAX_WEBAPP_URL` и кнопка `open_app` (ошибка `Link not found`)

Поле **`web_app`** в кнопке **`type: "open_app"`** — это **строка URL** мини-приложения в том же формате, что в официальной Go-схеме [`OpenAppButton`](https://github.com/max-messenger/max-bot-api-client-go/blob/main/schemes/schemes.go) (поле **`WebApp`** с JSON-тегом **`web_app`**). Оно **не** подменяется на объект вида `{ url: "…" }`.

Платформа MAX ищет этот URL в реестре **Link** (в логах ошибки встречается `LinkPK{name='…', space=TAMTAM}`). Если ссылка **не совпадает 1:1** с тем, что зарегистрировано для бота/мини-приложения в кабинете MAX, **`PUT /messages`** / **`POST /messages`** вернут **404** `not.found` / `Link not found`.

На что смотреть:

- **Полный URL с путём**: если в MAX указано `https://host/miniapp`, а в env — только `https://host`, lookup не найдёт link (и наоборот).
- **Слеш в конце корня** (`https://host/` vs `https://host`) и **регистр хоста** — бот при старте приводит URL к каноническому виду через **`normalizeWebAppUrl`** (см. `apps/bot/src/normalize-web-app-url.ts`), но **путь и схема должны совпадать с кабинетом**.
- **HTTPS**, без редиректа на другой origin для открытия приложения.

В логах бота при каждом **`POST /messages`** / **`PUT /messages`** с клавиатурой пишется событие с превью JSON (**`maxOpenAppOutgoing`**, **`webAppUrl`**, **`attachmentsJsonPreview`**). Сравните **`webAppUrl`** с тем, что видно в настройках мини-приложения MAX.

## Сценарий

1. **Publish post**  
   Вызвать ваш сценарий публикации (например `POST` на внутренний `publish` бота или сценарий из админки), чтобы в чате появилось сообщение с кнопкой `open_app` и `start_param=post_<id>`.

2. **Open mini app**  
   В клиенте MAX нажать кнопку под постом, убедиться что mini app открывается и в Bridge виден корректный `start_param`.

3. **Create comment**  
   Из mini app отправить комментарий с текстом (и при необходимости изображением).  
   Проверить: `POST /api/posts/:postId/comments` → 201, в БД комментарий `active`.

4. **Sync-button**  
   Убедиться, что текст кнопки под постом обновился на `Обсудить (N)` (логи API/bot без ошибок; при сбое — `POST /api/internal/posts/:postId/resync` после починки MAX/bot).

5. **Модерация (опционально)**  
   Скрыть/удалить комментарий в admin UI — счётчик на кнопке и лента mini app соответствуют правилам MVP.

## Отладка

- Логи API: ошибки `sync-button` / `fetch` к боту.
- Логи бота: ответы MAX API на `POST /messages` / `PUT /messages` (platform-api, не Telegram-style пути).
- Убедиться, что `BOT_INTERNAL_BASE_URL` с API указывает на реальный URL бота (внутрисетевой или публичный, как у вас принято).
- Сравнение **`open_app`** vs обычной **`link`**-кнопки и debug `PUT /messages`: [max-open-app-debug.md](max-open-app-debug.md).
