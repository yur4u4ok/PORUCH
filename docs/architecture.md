# Архітектура

## Принципи

* **Modular monolith.** Один Django-проєкт із чіткими межами між apps; без мікросервісів.
* **Models → Services → DRF API.** Складна логіка лише в `apps/*/services/`. Серіалізатори — валідація/серіалізація, моделі — інваріанти (DB constraints).
* **React → TanStack Query → REST API.** Компоненти не викликають `fetch` напряму: `src/api/*` + хуки у `src/features/*`.
* **Realtime:** React → WebSocket → Django Channels (Redis channel layer).
* **Notifications:** Django → Celery → Web Push. Ніколи не відправляються синхронно в HTTP-запиті.

## Backend

```text
backend/
├── config/            settings (base/development/production/test), urls, asgi, celery
├── common/            базові моделі, помилки, пагінація, permissions, throttling, geo, logging, analytics, health
└── apps/
    ├── users          User, Profile, Capability, UserCapability, SocialAccount; auth (cookie JWT), профіль
    ├── locations      City, Availability («Я зараз можу допомогти»)
    ├── help_requests  HelpRequest, категорії/статуси, PostGIS-пошук, lifecycle (create/update/cancel/complete/expire)
    ├── interactions   HelpResponse, respond, select helper (select_for_update), reject, withdraw
    ├── conversations  Conversation, ConversationParticipant, Message, WebSocket consumer, presence
    ├── notifications  Notification, NotificationPreference, PushSubscription, nearby matching, Web Push
    ├── media          Media, presigned upload, обробка зображень, S3
    ├── reputation     ThankYou, лічильники репутації
    └── moderation     Report, UserBlock
```

Залежності між apps ідуть через сервісні функції (наприклад, `interactions.services.responses.select_helper` викликає `conversations.services.conversations.get_or_create_for_help_request` і `notifications.services.notify.notify`). Це дозволяє в майбутньому виділити модуль без переписування.

### Ключові потоки

**Створення запиту**: `POST /help-requests/` → `create_help_request()` (валідація локації, фото, emergency ack, expires_at за терміновістю) → `transaction.on_commit` → Celery `send_nearby_help_notifications` → PostGIS-пошук отримувачів → `Notification` + `send_push_notification`.

**Вибір помічника**: `select_helper()` в `transaction.atomic()` блокує рядки `HelpRequest` і `HelpResponse` (`SELECT … FOR UPDATE`). Друга паралельна спроба бачить `IN_PROGRESS` і отримує `409 REQUEST_NOT_ACTIVE`. Повтор того самого вибору — ідемпотентний. Додатково БД гарантує один `ACCEPTED` відгук на запит (partial unique constraint).

**Завершення**: `IN_PROGRESS → COMPLETED` (лише автор), `helped_count += 1` (F-вираз), системне повідомлення в чаті, сповіщення помічнику. Подяка — лише після `COMPLETED`, одна на запит (unique constraint).

### Помилки

Усі помилки API мають формат `{code, message, details}` (`common/exceptions/handler.py`). Сервіси кидають `DomainError`-підкласи (`ValidationFailed`, `InvalidState` → 409, `Forbidden`, `NotFound`).

## Frontend

```text
frontend/src/
├── app/         App, router (lazy routes), guards, queryClient (глобальна обробка помилок), PWA update prompt
├── pages/       Home, CreateHelp, Nearby, HelpRequest, Conversations, Chat, Profile, Settings, Notifications, Auth, Onboarding
├── features/    auth, help, chat (WebSocket), notifications (push), location, profile — хуки та фічеві компоненти
├── components/  ui (дизайн-система: Button, Input, Modal, BottomSheet, Card, Map…), layout (AppLayout, навігація)
├── api/         client.ts (cookies, CSRF, refresh), auth/users/helpRequests/responses/conversations/notifications/media
├── stores/      Zustand: toast, location, nearby filters (лише UI-стан)
├── i18n/        i18next, locales/uk.json (готово до en/pl)
├── styles/      design tokens (CSS variables, світла/темна тема), global.css
└── sw.ts        service worker (Workbox)
```

* Server state — TanStack Query; UI state — Zustand; форми — React Hook Form + Zod.
* Кожен екран має стани loading / success / empty / error.
* Mobile-first (360–430 px), bottom navigation; на ≥1024 px — sidebar.
* Карта (MapLibre) завантажується ліниво лише на екранах з картою; провайдер тайлів — `VITE_MAP_STYLE_URL`.

## Масштабування

Ціль першої версії — 1 місто, 10k користувачів, 1k активних запитів. Далі: кілька інстансів backend (stateless, сесії в cookie/JWT), окремі Celery workers, PostgreSQL replicas для читання, Redis як спільний channel layer.
