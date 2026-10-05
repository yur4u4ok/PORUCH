from .base import *  # noqa: F401,F403

DEBUG = False
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_BROKER_URL = "memory://"
CELERY_RESULT_BACKEND = "cache+memory://"

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

AUTH_COOKIE_SECURE = False
ANALYTICS_BACKENDS = ["common.analytics.DatabaseBackend"]

AWS_ACCESS_KEY_ID = "testing"
AWS_SECRET_ACCESS_KEY = "testing"
AWS_S3_ENDPOINT_URL = None
AWS_S3_PUBLIC_ENDPOINT_URL = None
AWS_STORAGE_BUCKET_NAME = "test-bucket"
AWS_REGION = "us-east-1"

VAPID_PUBLIC_KEY = "test-public"
VAPID_PRIVATE_KEY = "test-private"

LOGGING["root"]["level"] = "WARNING"  # type: ignore[index]  # noqa: F405
