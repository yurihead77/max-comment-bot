# Ручная интеграция с MAX (production-like)

Автотесты и `smoke-functional.mjs` используют `BOT_MOCK_MAX_API` и не вызывают реальный MAX. Ниже — чеклист для **живой** проверки после выката на сервер с HTTPS, валидными токенами и webhook.

## Предусловия

- `NODE_ENV=production`, `DEV_MAX_AUTH_BYPASS=false`, `BOT_MOCK_MAX_API=false`.
- `MAX_BOT_TOKEN`, `MAX_API_BASE_URL`, `MAX_WEBAPP_URL` — боевые значения.
- Webhook бота на HTTPS URL, доступный из MAX.
- API и бот запущены (`start:prod`), БД с миграциями и seed.

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
- Логи бота: ответы MAX API на `editMessageReplyMarkup` / `sendMessage`.
- Убедиться, что `BOT_INTERNAL_BASE_URL` с API указывает на реальный URL бота (внутрисетевой или публичный, как у вас принято).
