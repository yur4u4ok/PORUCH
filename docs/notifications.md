# Сповіщення

## Типи

`NEW_NEARBY_REQUEST`, `HELP_RESPONSE_RECEIVED`, `HELP_RESPONSE_ACCEPTED`, `HELP_RESPONSE_REJECTED`, `NEW_MESSAGE`, `REQUEST_COMPLETED`, `THANK_YOU_RECEIVED`, `REQUEST_EXPIRING` (+ `REQUEST_CANCELLED` для помічника, коли автор скасовує запит у процесі).

Кожне сповіщення — запис `Notification` (центр сповіщень у застосунку) + за потреби push. Email-копія надсилається для ключових подій, якщо користувач увімкнув `email_enabled`.

## Архітектура

```text
POST /help-requests/ → create request → on_commit → Celery send_nearby_help_notifications
Celery → PostGIS matching → Notification (dedupe_key) → Celery send_push_notification → pywebpush (VAPID)
```

HTTP-запит ніколи не чекає на відправку push.

## Алгоритм `notify_users_about_help_request(help_request)`

1. Локація запиту.
2. Радіус: індивідуальний для кожного користувача (`notification_radius`) або радіус активної «доступності».
3. PostGIS: `ST_DWithin` з максимальним радіусом (10 км) по GIST-індексу + `ST_Distance <= radius` користувача — для локації з налаштувань і для локації «Я зараз можу допомогти».
4. Фільтр категорій (`enabled_categories` / категорії доступності).
5. Лише активні, підтверджені користувачі з `push_enabled`.
6. Виключити автора.
7. Виключити заблокованих (в обидва боки).
8. Виключити користувачів без push-підписки та тих, хто вже відгукувався (включно з відмовою).
9. Anti-spam: максимум `NOTIFICATION_NEARBY_LIMIT_PER_HOUR` (10) на годину; для високої терміновості (`NOW` або категорія `URGENT`) — окремий ліміт `NOTIFICATION_URGENT_LIMIT_PER_HOUR` (20). Лічильники — у Redis.
10. Створити `Notification` з `dedupe_key = nearby:{request}:{user}` і поставити push у чергу.

Локація для збігів — лише явно передана користувачем у foreground (онбординг, відкриття «Поруч», створення запиту, «Я зараз можу допомогти»). Фонового трекінгу немає.

## Доставка і захист від дублювання

* `send_push_notification(notification_id)` атомарно «захоплює» сповіщення (`UPDATE … WHERE push_sent_at IS NULL`), тож повторна задача нічого не відправить.
* Не відправляється push для закритого/простроченого запиту.
* `404/410` від push-сервісу → підписку видалено; інші помилки збільшують `failure_count`; `cleanup_invalid_push_subscriptions` (щоночі) видаляє підписки з ≥3 помилками.

## Зміст push

Без приватних даних: категорія, приблизна відстань, терміновість. Наприклад:

```text
🆘 Комусь поруч потрібна допомога
Проблема з автомобілем
📍 1,2 км від вас
🔴 Потрібна допомога зараз
```

## Клієнт

* `features/notifications/push.ts`: перевірка підтримки, запит дозволу, `pushManager.subscribe` з VAPID-ключем із `/api/v1/config/`, реєстрація на backend; синхронізація при кожному старті застосунку.
* Graceful degradation: «Push notifications недоступні у цьому браузері.»; для iOS — підказка встановити застосунок на головний екран.
* `sw.ts` `notificationclick`: знайти вікно застосунку → focus → navigate на `/help/{id}` або `/chats/{id}`; інакше відкрити нове вікно (працює і після cold start). Параметр `?n=<id>` позначає сповіщення прочитаним і рахує метрику `push_opened`.

## VAPID

`python manage.py generate_vapid_keys` → `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto: або https URL). Окремі ключі для кожного середовища.
