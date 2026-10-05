# API

* Базовий шлях: `/api/v1/`. OpenAPI: `/api/schema/`, Swagger UI: `/api/docs/` (публічно лише якщо `API_DOCS_PUBLIC=true`, інакше — для staff).
* UUID-ідентифікатори, дати ISO 8601 (UTC), пагінація `{count, next, previous, results}` (повідомлення чату — cursor-пагінація).
* Автентифікація: HttpOnly cookies `poruch_access` / `poruch_refresh` (JWT). Небезпечні методи потребують заголовка `X-CSRFToken` (значення cookie `csrftoken`, видається `GET /auth/csrf/`). Для не-браузерних клієнтів підтримується `Authorization: Bearer <access>`.
* Більшість ендпоінтів вимагають підтвердженого email (`403` інакше).

## Формат помилок

```json
{ "code": "VALIDATION_ERROR", "message": "Invalid request", "details": { "field": ["This field is required."] } }
```

Типові коди: `VALIDATION_ERROR`, `INVALID_LOCATION`, `NOT_AUTHENTICATED`, `PERMISSION_DENIED`, `NOT_FOUND`, `RATE_LIMITED` (`details.retry_after`), `INVALID_STATE`, `REQUEST_NOT_ACTIVE`, `OWN_REQUEST`, `NOT_AUTHOR`, `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `EMERGENCY_ACK_REQUIRED`, `INVALID_FILE`, `CONVERSATION_CLOSED`, `BLOCKED`.

## Ендпоінти

| Метод | Шлях | Опис |
|---|---|---|
| GET | `/auth/csrf/` | Встановлює CSRF cookie |
| POST | `/auth/register/` | Реєстрація (лист з підтвердженням) |
| POST | `/auth/login/` · `/auth/logout/` · `/auth/refresh/` | Сесія (cookies) |
| POST | `/auth/verify-email/` · `/auth/verify-email/resend/` | Підтвердження email |
| POST | `/auth/password-reset/` · `/auth/password-reset/confirm/` | Відновлення пароля |
| POST | `/auth/google/` | Google Sign-In (`credential` — ID token з Google Identity Services) |
| GET | `/config/` | Публічна конфігурація для фронтенду (VAPID public key, категорії, радіуси…) |
| GET | `/cities/` | Міста |
| GET/PATCH | `/me/` | Поточний користувач |
| POST | `/me/deactivate/` | Деактивація акаунта |
| GET/PATCH | `/me/preferences/` | `notification_radius`, `enabled_categories`, `push_enabled`, `email_enabled`, `location` |
| GET | `/capabilities/` | Каталог можливостей |
| GET/PUT | `/me/capabilities/` | Мої можливості (`{codes: [...]}`) |
| GET | `/users/{id}/` | Публічний профіль |
| GET | `/users/{id}/thanks/` | Подяки користувачу |
| GET | `/help-requests/?lat&lng&radius&category&urgency` | Пошук поруч (PostGIS) |
| GET | `/help-requests/?role=author\|helper\|responded&status=` | Історія |
| POST | `/help-requests/` | Створити запит |
| GET/PATCH/DELETE | `/help-requests/{id}/` | Деталі / редагування / скасування (soft) |
| POST | `/help-requests/{id}/respond/` · `cancel/` · `complete/` · `select-helper/` · `thank-you/` | Дії |
| GET | `/help-requests/{id}/responses/` | Відгуки (лише автор) |
| GET | `/help-responses/{id}/` | Відгук |
| POST | `/help-responses/{id}/accept/` · `reject/` · `cancel/` | Дії з відгуком |
| GET | `/conversations/` · `/conversations/{id}/` | Чати |
| GET/POST | `/conversations/{id}/messages/` | Повідомлення (`client_id` для ідемпотентності) |
| POST | `/conversations/{id}/read/` | Позначити прочитаним |
| GET | `/notifications/?unread=1` | Сповіщення (+ `unread_count`) |
| POST | `/notifications/{id}/read/` · `/notifications/read-all/` | Прочитання (`via_push` → метрика `push_opened`) |
| POST/DELETE | `/push-subscriptions/` · `/push-subscriptions/{id}/` | Web Push підписки |
| GET/POST/DELETE | `/availability/` | «Я зараз можу допомогти» |
| POST | `/media/upload-url/` · `/media/confirm/` · DELETE `/media/{id}/` | Завантаження фото |
| POST | `/reports/` | Скарга |
| GET | `/share/{code}/` | Публічний перегляд запиту за посиланням (без входу, без приватних даних) |
| GET/POST | `/blocks/` · DELETE `/blocks/{user_id}/` | Блокування |

Посилання для поширення: `/r/{code}` (поза `/api`) — HTML з Open Graph для месенджерів, перенаправляє на `/share/{code}` у застосунку. База посилань — `SHARE_BASE_URL`.

Службові: `/health/live/`, `/health/ready/` (перевіряє PostgreSQL і Redis), `/admin/`.

## Rate limits (за замовчуванням, `RATE_LIMIT_*`)

login 5/хв/IP · register 5/год/IP · створення запиту 10/год/користувач · respond 30/год · повідомлення 60/хв · скарги 20/год · завантаження 60/год.
