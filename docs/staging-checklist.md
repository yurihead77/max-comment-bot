# Чеклист staging (реальный MAX)

Используйте **staging** токен бота, HTTPS webhook URL и staging БД. Dev bypass должен быть выключен: `NODE_ENV=production`, `DEV_MAX_AUTH_BYPASS` unset/false, `BOT_MOCK_MAX_API` unset/false.

См. также: [max-integration-manual.md](max-integration-manual.md) (webhook URL, env, Nginx).

## 1. Webhook (HTTPS)

- [ ] В консоли разработчика MAX webhook URL использует **HTTPS** и указывает на сервис бота (например `https://bot.staging.example/webhook/max`).
- [ ] Процесс бота доступен из интернета; TLS завершается на Nginx (или load balancer).
- [ ] Опционально: secret header / IP-ограничения по production-политике.

## 2. Publish post

- [ ] Опубликуйте тестовый пост через MAX, чтобы бот получил событие (или используйте ваш сценарий регистрации поста).
- [ ] В API работает `POST /api/internal/posts/register` (или эквивалентная автоматизация), связывающий `chatId` + `messageId` с `postId`.

## 3. Inline button (`open_app`)

- [ ] Под постом отображается **«Обсудить»** (или **«Обсудить (N)»**) с `open_app` / deep link на mini app и `start_param=post_<uuid>`.

## 4. Auth inside mini app

- [ ] Откройте mini app из MAX; `initData` отправляется в `POST /api/auth/max/init` (без dev-mock).
- [ ] Сессия / `userId` работают; лента загружается для нужного `postId`.

## 5. Create comment

- [ ] Создайте комментарий с текстом (и, при необходимости, изображением).
- [ ] Комментарий появляется в публичной ленте для других пользователей того же поста (если применимо).
- [ ] Обсуждение открывается с системного заголовка (`thread_header`), затем идут комментарии пользователей.
- [ ] Reply-сценарий: ответ на существующий комментарий показывает цитату внутри bubble; клик по цитате прокручивает и подсвечивает исходный комментарий.
- [ ] Безопасность reply: при скрытом/удалённом родительском комментарии отображается корректный fallback-текст без ошибок UI.

## 6. Sync button update

- [ ] После изменений, влияющих на видимый счётчик комментариев, обновляется текст **«Обсудить (N)»** (ботовый `sync-button` путь исправен, креды MAX API корректны).
- [ ] Если счётчик неверный, используйте resync flow из ops-документации после восстановления bot/MAX.

## 7. Admin (staging)

- [ ] Admin UI работает по HTTPS; вход под seeded admin.
- [ ] Logout: после **Logout** защищённые API-вызовы возвращают **401** (сессия инвалидируется на сервере и cookie очищается).

## 8. Upload URL shape (manual)

- [ ] Установите `UPLOAD_PUBLIC_BASE_URL` в `https://<host>/uploads` (без завершающего слэша), загрузите изображение и проверьте, что URL в БД имеет вид `https://<host>/uploads/<filename>` без `//` в пути.
- [ ] Повторите проверку с **path prefix**, например `https://<host>/api/staging/uploads`.

Автоматическая проверка той же логики join URL (без HTTP):

```bash
node scripts/verify-upload-public-url.mjs
```

Ожидаемый результат: `UPLOAD_PUBLIC_URL_OK`.
