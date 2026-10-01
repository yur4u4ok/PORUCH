# База даних

PostgreSQL 16 + PostGIS 3.4. Усі координати — `geography(Point, 4326)`; відстані в метрах рахує PostGIS.

## ERD

```text
User ─┬─ Profile (1:1)              display_name, avatar→Media, city→City, privacy, helped_count, thanks_received_count
      ├─ UserCapability ── Capability (code, kind HELP|ITEM, category)
      ├─ SocialAccount               provider + uid (Google, далі Apple)
      ├─ NotificationPreference (1:1) radius, enabled_categories[], push/email, location (geography)
      ├─ PushSubscription            endpoint (unique), p256dh, auth, failure_count
      ├─ Availability (1:1)          is_active, location, radius, categories[], expires_at
      ├─ Notification                type, title, body, url, dedupe_key (unique), read_at, push_sent_at
      ├─ Media                       owner, kind, status, S3 keys
      ├─ HelpRequest (author)
      │     ├─ photos ⟷ Media (M2M)
      │     ├─ HelpResponse (helper)
      │     ├─ Conversation (helper) ─┬─ ConversationParticipant
      │     │                         └─ Message (sender, attachment→Media, client_id)
      │     └─ ThankYou (from_user → to_user)
      ├─ Report (reporter, target_user | help_request | message)
      └─ UserBlock (blocker, blocked)
City · AnalyticsEvent
```

## Індекси

| Таблиця | Індекси |
|---|---|
| `help_requests_helprequest` | GIST(`location`); `status`, `category`, `urgency`, `created_at`, `expires_at`; `(status, expires_at)`, `(author, status)`, `(selected_helper, status)` |
| `interactions_helpresponse` | `help_request`, `helper` |
| `conversations_message` | `conversation`, `created_at`, `(conversation, -created_at)` |
| `notifications_notification` | `user`, `created_at`, `(user, -created_at)` |
| `notifications_notificationpreference` | GIST(`location`) |
| `locations_availability` | GIST(`location`), `(is_active, expires_at)` |

## Обмеження (database-level)

* `unique_active_response_per_user_request` — один `PENDING|ACCEPTED` відгук користувача на запит.
* `single_accepted_response_per_request` — лише один прийнятий відгук на запит.
* `hr_in_progress_has_helper` — `IN_PROGRESS`/`COMPLETED` мають `selected_helper`.
* `hr_reward_amount_non_negative`.
* `unique_thank_you_per_request`, `unique_block_pair`, `block_not_self`, `report_has_target`.
* `unique_message_client_id` — `(sender, client_id)` для ідемпотентних відправок.
* `Notification.dedupe_key` unique — захист від дублювання push.

## Геопошук

```sql
-- Пошук поруч (згенерований ORM-запит, спрощено)
SELECT *, ST_Distance(location, :point) AS distance
FROM help_requests_helprequest
WHERE status = 'ACTIVE' AND expires_at > now()
  AND ST_DWithin(location, :point, :radius_m)
ORDER BY round(distance / 100), urgency_rank, created_at DESC;
```

Сортування: відстань (з точністю 100 м — те, що бачить користувач) → терміновість → новизна. Жодних Python-циклів для гео.

## Статуси

```text
HelpRequest: ACTIVE → IN_PROGRESS → COMPLETED;  ACTIVE|IN_PROGRESS → CANCELLED;  ACTIVE → EXPIRED
HelpResponse: PENDING → ACCEPTED | REJECTED | CANCELLED;  ACCEPTED → CANCELLED (помічник відмовився → запит знову ACTIVE)
```

Запит стає `EXPIRED` через Celery-задачу `expire_help_requests` (кожну хвилину). Строк дії: NOW 6 год, TODAY 24 год, WHENEVER 72 год (налаштовується).
