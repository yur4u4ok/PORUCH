# Realtime (чат)

## WebSocket

`/ws/conversations/{conversation_id}/` — Django Channels (`apps/conversations/consumers.py`), Redis channel layer.

* Автентифікація — HttpOnly cookie з access JWT (`CookieJWTAuthMiddleware`), перевірка Origin (`AllowedHostsOriginValidator`). Доступ лише учасникам розмови (інакше закриття з кодом `4403`).
* Повідомлення **надсилаються через REST** (`POST /conversations/{id}/messages/`), що дає валідацію, rate limit та ідемпотентність; WebSocket доставляє події.

### Події сервер → клієнт

| Подія | Payload |
|---|---|
| `message.created` | серіалізоване повідомлення |
| `message.read` | `{reader_id, message_ids, read_at}` |
| `typing.started` / `typing.stopped` | `{user_id}` |
| `user.online` / `user.offline` | `{user_id}` |

### Клієнт → сервер

`{"type": "typing.started" | "typing.stopped" | "ping"}` (на `ping` сервер відповідає `pong` і продовжує presence TTL).

## Presence і push

Presence — лічильник з'єднань у кеші Redis (`presence:{conversation}:{user}`, TTL 5 хв, heartbeat кожні 25 с). Якщо отримувач не підключений до розмови — створюється `NEW_MESSAGE` і push.

## Клієнт (`features/chat/useConversationSocket.ts`)

* Reconnect з експоненційною затримкою (до 15 с) + jitter; при `offline` — очікування події `online`.
* Після reconnect — повторне завантаження останніх повідомлень (заповнення пропусків).
* На `4403` (протермінований access cookie) — одна спроба оновити сесію.
* Стан з'єднання в UI: «reconnecting…».

## Optimistic UI і дублікати

Кожне повідомлення має `client_id` (UUID з клієнта). Optimistic-повідомлення показується одразу; відповідь REST і подія WebSocket замінюють його за `id`/`client_id` (`upsertMessage`), тому дублікатів немає. Повторна відправка з тим самим `client_id` повертає те саме повідомлення (`200`), БД гарантує унікальність `(sender, client_id)`.

## Прочитання

Відкритий чат у видимій вкладці позначає вхідні повідомлення прочитаними (`POST /read/`), сервер розсилає `message.read`, відправник бачить ✓✓.
