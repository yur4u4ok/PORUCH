"""Base settings shared by all environments."""

from datetime import timedelta
from pathlib import Path

import environ
from celery.schedules import crontab

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR.parent / ".env", overwrite=False)

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])
ENVIRONMENT = env("DJANGO_ENVIRONMENT", default="development")

FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:5173")
# Public base for share links, e.g. https://poruch.app → https://poruch.app/r/<code>
SHARE_BASE_URL = env("SHARE_BASE_URL", default=FRONTEND_URL)

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.gis",
    "django.contrib.postgres",
    # third party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "corsheaders",
    "channels",
    # local
    "common",
    "apps.users",
    "apps.locations",
    "apps.media",
    "apps.help_requests",
    "apps.interactions",
    "apps.conversations",
    "apps.notifications",
    "apps.reputation",
    "apps.moderation",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "common.middleware.RequestLoggingMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
ASGI_APPLICATION = "config.asgi.application"
WSGI_APPLICATION = None

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --- Database -------------------------------------------------------------
DATABASES = {"default": env.db("DATABASE_URL", engine="django.contrib.gis.db.backends.postgis")}
DATABASES["default"]["ENGINE"] = "django.contrib.gis.db.backends.postgis"
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DATABASE_CONN_MAX_AGE", default=60)
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Redis / cache / channels ---------------------------------------------
REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
        "KEY_PREFIX": "poruch",
    }
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

# --- Celery ---------------------------------------------------------------
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default=REDIS_URL)
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default=CELERY_BROKER_URL)
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=False)
CELERY_TIMEZONE = "UTC"
CELERY_BEAT_SCHEDULE = {
    "expire-help-requests": {
        "task": "apps.help_requests.tasks.expire_help_requests",
        "schedule": timedelta(minutes=1),
    },
    "expire-availability": {
        "task": "apps.locations.tasks.expire_availability",
        "schedule": timedelta(minutes=1),
    },
    "cleanup-expired-media": {
        "task": "apps.media.tasks.cleanup_expired_media",
        "schedule": crontab(minute=17),
    },
    "cleanup-invalid-push-subscriptions": {
        "task": "apps.notifications.tasks.cleanup_invalid_push_subscriptions",
        "schedule": crontab(hour=3, minute=30),
    },
}

# --- Auth -----------------------------------------------------------------
AUTH_USER_MODEL = "users.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

EMAIL_VERIFICATION_MAX_AGE = env.int("EMAIL_VERIFICATION_MAX_AGE", default=60 * 60 * 24 * 3)
PASSWORD_RESET_MAX_AGE = env.int("PASSWORD_RESET_MAX_AGE", default=60 * 60 * 2)

GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID", default="")
GOOGLE_CLIENT_SECRET = env("GOOGLE_CLIENT_SECRET", default="")

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_MINUTES", default=15)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_DAYS", default=30)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "SIGNING_KEY": SECRET_KEY,
}

# Auth cookies (HttpOnly). Access cookie is sent everywhere, refresh only to auth endpoints.
AUTH_COOKIE_ACCESS = "poruch_access"
AUTH_COOKIE_REFRESH = "poruch_refresh"
AUTH_COOKIE_REFRESH_PATH = "/api/v1/auth/"
AUTH_COOKIE_SECURE = env.bool("AUTH_COOKIE_SECURE", default=not DEBUG)
AUTH_COOKIE_SAMESITE = env("AUTH_COOKIE_SAMESITE", default="Lax")
AUTH_COOKIE_DOMAIN = env("AUTH_COOKIE_DOMAIN", default=None)

CSRF_COOKIE_SECURE = AUTH_COOKIE_SECURE
CSRF_COOKIE_SAMESITE = AUTH_COOKIE_SAMESITE
CSRF_COOKIE_HTTPONLY = False  # frontend reads it to send X-CSRFToken
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[FRONTEND_URL])
SESSION_COOKIE_SECURE = AUTH_COOKIE_SECURE

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[FRONTEND_URL])
CORS_ALLOW_CREDENTIALS = True

# --- DRF ------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["apps.users.authentication.CookieJWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["common.permissions.IsVerifiedUser"],
    "DEFAULT_PAGINATION_CLASS": "common.pagination.DefaultPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "common.exceptions.handler.api_exception_handler",
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_THROTTLE_RATES": {
        "login": env("RATE_LIMIT_LOGIN", default="5/minute"),
        "register": env("RATE_LIMIT_REGISTER", default="5/hour"),
        "password_reset": env("RATE_LIMIT_PASSWORD_RESET", default="5/hour"),
        "create_help_request": env("RATE_LIMIT_CREATE_HELP_REQUEST", default="10/hour"),
        "respond": env("RATE_LIMIT_RESPOND", default="30/hour"),
        "messages": env("RATE_LIMIT_MESSAGES", default="60/minute"),
        "reports": env("RATE_LIMIT_REPORTS", default="20/hour"),
        "support": env("RATE_LIMIT_SUPPORT", default="5/hour"),
        "media_upload": env("RATE_LIMIT_MEDIA_UPLOAD", default="60/hour"),
        "share_preview": env("RATE_LIMIT_SHARE_PREVIEW", default="120/minute"),
    },
    "DATETIME_FORMAT": "iso-8601",
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Poruch — API локальної мережі взаємодопомоги",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "NotificationCategoryEnum": "apps.help_requests.constants.NOTIFICATION_CATEGORY_VALUES",
    },
}
API_DOCS_PUBLIC = env.bool("API_DOCS_PUBLIC", default=DEBUG)

# --- i18n -----------------------------------------------------------------
LANGUAGE_CODE = "uk"
LANGUAGES = [("uk", "Українська"), ("en", "English"), ("pl", "Polski")]
LOCALE_PATHS = [BASE_DIR / "locale"]
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# --- Static ---------------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

# --- Email ----------------------------------------------------------------
EMAIL_CONFIG = env.email_url("EMAIL_URL", default="consolemail://")
vars().update(EMAIL_CONFIG)
# Where «Підтримка» messages go. Empty = support form disabled.
SUPPORT_EMAIL = env("SUPPORT_EMAIL", default="")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Poruch <no-reply@poruch.local>")

# Days to keep database backups in object storage (manage.py backups).
BACKUP_KEEP_DAYS = env.int("BACKUP_KEEP_DAYS", default=14)

# --- S3 media -------------------------------------------------------------
AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default="")
AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default="")
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default="poruch-media")
AWS_REGION = env("AWS_REGION", default="eu-central-1")
# Internal endpoint used by the backend (e.g. http://s3:8333). Empty = AWS.
AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL", default=None)
# Endpoint reachable by browsers, used to sign presigned URLs. Defaults to the internal one.
AWS_S3_PUBLIC_ENDPOINT_URL = env("AWS_S3_PUBLIC_ENDPOINT_URL", default=AWS_S3_ENDPOINT_URL)
MEDIA_MAX_UPLOAD_BYTES = env.int("MEDIA_MAX_UPLOAD_BYTES", default=10 * 1024 * 1024)
MEDIA_ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"]
MEDIA_MAX_DIMENSION = env.int("MEDIA_MAX_DIMENSION", default=1600)
MEDIA_THUMBNAIL_DIMENSION = env.int("MEDIA_THUMBNAIL_DIMENSION", default=400)
MEDIA_PRESIGNED_TTL = env.int("MEDIA_PRESIGNED_TTL", default=60 * 15)
MEDIA_PENDING_TTL_HOURS = env.int("MEDIA_PENDING_TTL_HOURS", default=24)

# --- Web Push -------------------------------------------------------------
VAPID_PUBLIC_KEY = env("VAPID_PUBLIC_KEY", default="")
VAPID_PRIVATE_KEY = env("VAPID_PRIVATE_KEY", default="")
VAPID_SUBJECT = env("VAPID_SUBJECT", default="mailto:admin@poruch.local")
PUSH_TTL_SECONDS = env.int("PUSH_TTL_SECONDS", default=60 * 60 * 6)

# --- Product rules --------------------------------------------------------
HELP_REQUEST_EXPIRATION_HOURS = {
    "NOW": env.int("HELP_REQUEST_EXPIRES_NOW_HOURS", default=6),
    "TODAY": env.int("HELP_REQUEST_EXPIRES_TODAY_HOURS", default=24),
    "WHENEVER": env.int("HELP_REQUEST_EXPIRES_WHENEVER_HOURS", default=72),
}
HELP_REQUEST_DEFAULT_EXPIRATION_HOURS = 24
HELP_REQUEST_EXPIRING_NOTICE_MINUTES = env.int("HELP_REQUEST_EXPIRING_NOTICE_MINUTES", default=60)
HELP_REQUEST_MAX_PHOTOS = 5
NEARBY_ALLOWED_RADII = [500, 1000, 3000, 5000, 10000, 20000]
NEARBY_DEFAULT_RADIUS = 3000
NEARBY_MAX_RADIUS = 20000
# Grid used to blur locations for non-participants (degrees).
APPROXIMATE_LOCATION_GRID_DEG = env.float("APPROXIMATE_LOCATION_GRID_DEG", default=0.005)
APPROXIMATE_DISTANCE_STEP_M = 100
LOCATION_MAX_ACCURACY_M = env.int("LOCATION_MAX_ACCURACY_M", default=5000)
AVAILABILITY_DEFAULT_HOURS = env.int("AVAILABILITY_DEFAULT_HOURS", default=2)
AVAILABILITY_MAX_HOURS = env.int("AVAILABILITY_MAX_HOURS", default=12)
NOTIFICATION_NEARBY_LIMIT_PER_HOUR = env.int("NOTIFICATION_NEARBY_LIMIT_PER_HOUR", default=10)
NOTIFICATION_URGENT_LIMIT_PER_HOUR = env.int("NOTIFICATION_URGENT_LIMIT_PER_HOUR", default=20)
PRESENCE_TTL_SECONDS = 60 * 5

# --- Analytics ------------------------------------------------------------
ANALYTICS_BACKENDS = env.list(
    "ANALYTICS_BACKENDS",
    default=["common.analytics.LoggingBackend", "common.analytics.DatabaseBackend"],
)

# --- Logging --------------------------------------------------------------
LOG_LEVEL = env("LOG_LEVEL", default="INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {"()": "common.logging.JsonFormatter"},
    },
    "filters": {
        "request_context": {"()": "common.logging.RequestContextFilter"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
            "filters": ["request_context"],
        },
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django.request": {"level": "ERROR"},
        "django.server": {"level": "WARNING"},
        "daphne": {"level": "WARNING"},
    },
}
