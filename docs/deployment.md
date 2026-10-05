# Деплой

## Середовища

`development` · `staging` · `production` — окремі БД, Redis, S3 bucket, секрети, VAPID-ключі, Google OAuth client.

## Образи

* `backend/Dockerfile` target `production`: Python 3.12 slim + GDAL, non-root user, `collectstatic` під час збірки, Daphne (`config.asgi:application`, HTTP + WebSocket), healthcheck `/health/live/`.
* `frontend/Dockerfile` target `production`: збірка Vite → Nginx (статика PWA, `no-cache` для `sw.js`/manifest, immutable assets, reverse-proxy `/api`, `/ws`, `/admin`, `/static`, `/health`).

## Поточний production

* Сервер Hetzner (Ubuntu), домен `poruch-app.duckdns.org`, код у `/opt/poruch`.
* HTTPS — контейнер Caddy (Let's Encrypt, автопродовження), далі Nginx фронтенду → Django.
* Фото — Cloudflare R2 (завантаження через presigned PUT: R2 не підтримує presigned POST). CORS bucket'а дозволяє `https://poruch-app.duckdns.org`.
* Налаштування — лише на сервері: `/opt/poruch/.env.production` (права 600, у git не потрапляє).
* Оновлення: `scripts/deploy.sh` (копіює код, збирає образи, міграції, перезапуск, перевірка здоров'я).
* Файрвол ufw: відкриті лише 22, 80, 443.

## Docker Compose (один сервер)

```bash
cp .env.example .env.production   # заповніть production-значення
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate   # контрольований крок
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend python manage.py createsuperuser
```

TLS термінує контейнер `caddy` (потрібна змінна `DOMAIN` у `.env.production`). Nginx фронтенду зберігає `X-Forwarded-Proto` від Caddy. `DJANGO_ALLOWED_HOSTS` має містити й `localhost` для healthcheck.

### Обов'язкові production-змінні

`DJANGO_SECRET_KEY` (довгий випадковий), `DJANGO_ALLOWED_HOSTS`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` (https), `DATABASE_URL`, `REDIS_URL`, `CELERY_BROKER_URL`, `AWS_*` (без `AWS_S3_ENDPOINT_URL` для AWS), `VAPID_*`, `EMAIL_URL` (SMTP провайдера), `GOOGLE_CLIENT_ID`, `API_DOCS_PUBLIC=false`.

## Kubernetes

Ті самі образи:

| Workload | Команда | Примітки |
|---|---|---|
| Deployment `backend` | `daphne -b 0.0.0.0 -p 8000 --proxy-headers config.asgi:application` | readiness `/health/ready/`, liveness `/health/live/`, кілька реплік |
| Deployment `celery` | `celery -A config worker -l info` | масштабується горизонтально |
| Deployment `celery-beat` | `celery -A config beat -l info` | **рівно 1 репліка** |
| Deployment `frontend` | Nginx | або статика на CDN |
| Job `migrate` | `python manage.py migrate --noinput` | запускається перед rollout (Helm hook / Argo sync wave) |

WebSocket: Ingress має підтримувати Upgrade і довгі таймаути (`/ws/`). Redis — спільний для всіх реплік (channel layer).

## Міграції

Не запускаються автоматично на старті контейнерів у production. Порядок релізу: build → migrate (Job) → rollout backend/celery → rollout frontend. Небезпечні міграції (видалення колонок) — у два релізи (expand/contract).

## CI/CD

`.github/workflows/ci.yml`: install → lint (ruff, black, eslint, prettier) → typecheck (mypy, tsc) → tests (pytest з PostGIS, vitest) → build → docker build → E2E (Playwright проти docker compose). Гілки: `main`, `develop`, `feature/*`, `fix/*`; PR мають проходити CI.

## Спостережуваність

* JSON-логи у stdout (збираються Loki/ELK/CloudWatch).
* `/health/live/`, `/health/ready/` (PostgreSQL + Redis).
* Продуктові події — `common.analytics.track()` (лог + таблиця `AnalyticsEvent`; можна під'єднати PostHog додавши backend у `ANALYTICS_BACKENDS`).

## Бекапи

Регулярні `pg_dump`/PITR для PostgreSQL; версіонування bucket'а S3.
