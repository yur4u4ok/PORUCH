# Поруч — локальна мережа взаємодопомоги

PWA, у якій люди поруч допомагають одне одному:

> **«Мені потрібна допомога → люди поруч отримують повідомлення → хтось може допомогти → допомога відбулася → людина дякує».**

Це не маркетплейс послуг: немає «замовників», «виконавців», обов'язкових оплат чи комісій. Репутація — це реальні допомоги та подяки.

---

## 1. Project overview

| Можливість | Де реалізовано |
|---|---|
| Реєстрація email + пароль, підтвердження email, відновлення пароля, Google Sign-In | `backend/apps/users`, `frontend/src/pages/Auth` |
| Профіль, можливості («Можу допомогти», «Маю»), приватність | `apps/users`, `pages/Profile`, `pages/Settings` |
| Запит про допомогу (wizard: категорія → опис → місце → терміновість → подяка → фото → підтвердження) | `apps/help_requests`, `pages/CreateHelp` |
| Пошук поруч через PostGIS (`ST_DWithin` / `ST_Distance`), список і карта (MapLibre) | `apps/help_requests/selectors.py`, `pages/Nearby` |
| «Можу допомогти», вибір помічника (захист від гонок), завершення, подяка | `apps/interactions`, `apps/reputation` |
| Realtime-чат (Django Channels + WebSocket), прочитання, «друкує…», reconnect | `apps/conversations`, `pages/Chat` |
| Розумні push-сповіщення (Web Push, VAPID, Celery, anti-spam) | `apps/notifications`, `frontend/src/sw.ts` |
| «Я зараз можу допомогти» (тимчасова доступність) | `apps/locations`, `features/help/AvailabilityToggle.tsx` |
| Фото: presigned upload у S3, перевірка реального MIME, resize, thumbnail, видалення EXIF | `apps/media` |
| Скарги, блокування, приховування точної локації, попередження про екстрені служби | `apps/moderation`, `common/utils/geo.py` |
| Django Admin, health checks, structured logging, аналітичні події | `common/`, `*/admin.py` |

## 2. Architecture

Modular monolith (без мікросервісів):

```text
React PWA ──TanStack Query──▶ Django REST API (/api/v1) ──▶ PostgreSQL + PostGIS
    │                               │
    └──WebSocket──▶ Django Channels ┤──▶ Redis (channel layer, cache, rate limits, broker)
                                    │
                         Celery worker/beat ──▶ Web Push · Email · S3
```

* **Backend:** Django 5.2, DRF, Channels (Daphne), Celery, Redis, PostGIS, drf-spectacular.
* **Frontend:** React 19, TypeScript (strict), Vite, React Router, TanStack Query, Zustand, React Hook Form + Zod, MapLibre GL JS, Workbox (vite-plugin-pwa), i18next.
* Бізнес-логіка — у **service layer** (`apps/*/services/`), серіалізатори лише валідують і серіалізують.

Детальніше: [docs/architecture.md](docs/architecture.md).

## 3. Requirements

* Docker + Docker Compose v2 (рекомендовано для всього стеку).
* Для запуску без Docker: Python 3.12, Node.js 22, системні бібліотеки GDAL/GEOS/PROJ:
  ```bash
  sudo apt install -y python3.12-venv gdal-bin libgdal-dev libgeos-dev libproj-dev
  ```

## 4. Local setup

```bash
git clone <repo-url> poruch && cd poruch
cp .env.example .env
docker compose up
```

Після старту:

| Сервіс | URL |
|---|---|
| PWA (Vite dev server) | http://localhost:5173 |
| API / OpenAPI (Swagger) | http://localhost:8000/api/docs/ |
| Django Admin | http://localhost:8000/admin/ |
| Mailpit (листи, підтвердження email) | http://localhost:8025 |
| S3 (SeaweedFS) | http://localhost:9000 |

Демо-дані та адміністратор:

```bash
docker compose exec backend python manage.py seed_demo_data      # *@demo.poruch.local / demo-pass-123
docker compose exec backend python manage.py createsuperuser
```

## 5. Environment variables

Усі змінні — у [`.env.example`](.env.example) (секрети не комітяться, `.env` у `.gitignore`).

| Змінна | Призначення |
|---|---|
| `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS` | Django |
| `DATABASE_URL` | PostGIS (`postgis://user:pass@host:5432/db`) |
| `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` | Redis |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_STORAGE_BUCKET_NAME`, `AWS_REGION` | S3 |
| `AWS_S3_ENDPOINT_URL`, `AWS_S3_PUBLIC_ENDPOINT_URL` | S3-сумісне сховище (внутрішній та публічний endpoint) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `FRONTEND_URL` | Origins і посилання в листах |
| `EMAIL_URL`, `DEFAULT_FROM_EMAIL` | Пошта |
| `RATE_LIMIT_*`, `NOTIFICATION_NEARBY_LIMIT_PER_HOUR` | Rate limits / anti-spam |
| `VITE_MAP_STYLE_URL` | Стиль/провайдер тайлів карти (будь-який MapLibre style) |

## 6. Docker

* `docker-compose.yml` — повне dev-середовище: `postgres`, `redis`, `s3`, `mailpit`, `backend`, `celery`, `celery-beat`, `frontend`.
* `docker-compose.dev.yml` — лише інфраструктура (для запуску backend/frontend нативно).
* `docker-compose.prod.yml` — production-подібний стек (Daphne, Nginx зі статикою PWA та reverse-proxy).
* Образи: `backend/Dockerfile` (`dev`, `production`), `frontend/Dockerfile` (`dev`, `production` на Nginx).

## 7. Database

PostgreSQL 16 + PostGIS 3.4. Координати — `PointField(geography=True, srid=4326)` з GIST-індексами; геопошук виконується лише в SQL. Схема, індекси та обмеження: [docs/database.md](docs/database.md).

## 8. Migrations

```bash
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
```

CI перевіряє `makemigrations --check` і `migrate`. У production міграції — окремий контрольований крок (див. Deployment). Довідкові дані (каталог можливостей, місто Львів) додаються data-міграціями.

## 9. Running tests

```bash
# Backend (pytest + pytest-django, PostGIS потрібен)
docker compose exec backend pytest
# або нативно з venv: cd backend && ../.venv/bin/pytest

# Frontend unit (Vitest + React Testing Library)
cd frontend && npm test

# E2E (Playwright, потрібен запущений docker compose стек)
cd frontend && npx playwright install chromium && npm run e2e

# Лінтери / типи
cd backend && ruff check . && black --check . && mypy .
cd frontend && npm run lint && npm run typecheck && npm run format:check
```

## 10. Running frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, проксі /api і /ws на VITE_PROXY_TARGET (default http://localhost:8000)
npm run build        # production build у dist/ (з service worker)
```

## 11. Running backend

```bash
docker compose -f docker-compose.dev.yml up -d           # PostGIS, Redis, S3, Mailpit
python3 -m venv .venv && .venv/bin/pip install -r backend/requirements/dev.txt
cd backend
../.venv/bin/python manage.py migrate
../.venv/bin/python manage.py init_storage                # створює S3 bucket
../.venv/bin/python manage.py runserver                   # ASGI (Daphne): HTTP + WebSocket
../.venv/bin/celery -A config worker -l info              # в окремому терміналі
../.venv/bin/celery -A config beat -l info                # періодичні задачі
```

## 12. PWA development

* Service worker: `frontend/src/sw.ts` (Workbox `injectManifest`): кешований app shell (offline), Web Push, обробка `notificationclick` (фокус існуючого вікна → навігація або нове вікно).
* Manifest генерується з `vite.config.ts` (standalone, іконки, theme/background color).
* У dev SW увімкнено (`devOptions.enabled`). Push та встановлення PWA потребують `localhost` або HTTPS.
* iPhone: push працює лише для застосунку, доданого на головний екран (Safari → Поділитися → На початковий екран).

## 13. Web Push setup

```bash
docker compose exec backend python manage.py generate_vapid_keys
```

Вставте `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` у `.env`, перезапустіть `backend` і `celery`. Публічний ключ віддається фронтенду через `/api/v1/config/`. Деталі алгоритму та anti-spam: [docs/notifications.md](docs/notifications.md).

## 14. S3 setup

* Локально — SeaweedFS (S3 API) у `docker compose`; облікові дані dev — `infra/seaweedfs/s3.json`, bucket створює `python manage.py init_storage`.
* Production — будь-яке S3-сумісне сховище (AWS S3, Cloudflare R2, MinIO cluster): задайте `AWS_*`. Bucket приватний; доступ до файлів — через короткоживучі presigned URL.
* Для браузерних завантажень налаштуйте CORS bucket'а на ваш `FRONTEND_URL` (метод `POST`).

## 15. Deployment

Коротко (детально — [docs/deployment.md](docs/deployment.md)):

```bash
cp .env.example .env.production   # production-значення, DJANGO_DEBUG=false, HTTPS origins
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Окремі середовища `development / staging / production` мають окремі БД, Redis, сховище, секрети та VAPID-ключі.

---

### Документація

[architecture](docs/architecture.md) · [api](docs/api.md) · [database](docs/database.md) · [notifications](docs/notifications.md) · [realtime](docs/realtime.md) · [security](docs/security.md) · [deployment](docs/deployment.md) · [ТЗ](docs/task_to_do.txt)

> ⚠️ Цей сервіс не замінює екстрені служби. У небезпечній або критичній ситуації телефонуйте 112 / 101 / 102 / 103.
