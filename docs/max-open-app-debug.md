# Диагностика MAX `open_app` vs `link` (Link not found)

Когда **`PUT /messages`** возвращает **404** `Link not found` / `LinkPK{…, space=TAMTAM}`, а webhook и остальной pipeline в порядке, нужно понять: падает ли **только** резолв мини-приложения для **`open_app`**, или **любая** кнопка с тем же URL.

## 1. Режим `link` вместо `open_app` (sync + publish)

Переменная **`MAX_OPEN_APP_DEBUG_MODE`**:

- **`open_app`** (по умолчанию) — как в проде: кнопка мини-приложения, поле **`web_app`**.
- **`link`** — обычная URL-кнопка с тем же **`MAX_WEBAPP_URL`** (поле **`url`**), без `open_app`.

Пример:

```bash
MAX_OPEN_APP_DEBUG_MODE=link
```

Перезапустите бот. Дальше **`/internal/sync-button`** и **`POST /internal/publish`** будут собирать клавиатуру в выбранном режиме.

**Интерпретация:**

- **`link` проходит**, **`open_app`** — 404 → очень похоже на проблему **реестра mini app link** на стороне MAX для этого бота/URL.
- **Оба падают** → смотреть шире (токен, `message_id`, сеть, не тот API host и т.д.).

## 2. Точечный `PUT /messages` без смены режима в env

**`POST`** на бот (тот же хост/порт, что и остальные internal routes):

`POST /internal/debug/put-messages-button`

Тело JSON:

| Поле | Обязательно | Описание |
|------|----------------|----------|
| `messageId` | да | `mid.…` существующего сообщения в MAX |
| `buttonType` | да | **`open_app`** или **`link`** |
| `buttonText` | нет | по умолчанию `Debug` |
| `startParam` | нет | для `open_app`, по умолчанию `debug_put` |
| `linkUrl` | нет | для `buttonType: link` — свой URL; иначе берётся **`MAX_WEBAPP_URL`** |

Пример:

```bash
curl -sS -X POST "http://127.0.0.1:3002/internal/debug/put-messages-button" \
  -H "content-type: application/json" \
  -d '{"messageId":"mid.….","buttonType":"open_app"}'
```

Повторите с **`"buttonType":"link"`** и сравните **`status`**, **`responseBodyPreview`** и логи бота.

## 3. Логи

Ищите поля:

- **`maxBotTokenSha256Prefix`** — отпечаток токена (не сам токен).
- **`maxWebappUrlNormalized`** — значение **`MAX_WEBAPP_URL`** после **`normalizeWebAppUrl`**.
- **`discussInlineMode`** / **`requestButtonType`** / **`inlineButtonType`** — какой тип кнопки ушёл в MAX.
- **`attachmentsJsonPreview`** / **`requestPayloadPreview`** — тело запроса к **`PUT /messages`**.

## 4. Безопасность

Debug-маршрут **меняет клавиатуру реального сообщения** в MAX. Вызывайте только на тестовых `messageId`. В проде ограничьте доступ к internal URL (firewall / только loopback / VPN), как и для остальных **`/internal/*`**.
