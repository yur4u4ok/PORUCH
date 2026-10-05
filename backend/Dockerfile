# syntax=docker/dockerfile:1.7
FROM python:3.12-slim-bookworm AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends gdal-bin libgdal-dev libgeos-dev libproj-dev curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS dev
COPY requirements/ requirements/
RUN pip install -r requirements/dev.txt
COPY . .
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

FROM base AS production
RUN useradd --create-home --uid 1000 app
COPY requirements/ requirements/
RUN pip install -r requirements/base.txt
COPY --chown=app:app . .
ENV DJANGO_SETTINGS_MODULE=config.settings.production
RUN DJANGO_SECRET_KEY=build-only DATABASE_URL=postgis://x:x@localhost/x python manage.py collectstatic --noinput
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD curl -fs http://localhost:8000/health/live/ || exit 1
# Several worker processes (HTTP + WebSocket); realtime events between them go through Redis.
ENV WEB_CONCURRENCY=3
CMD ["sh", "-c", "exec uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY} --proxy-headers --forwarded-allow-ips='*' --no-server-header"]
