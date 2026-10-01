from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse


def live(request):
    return JsonResponse({"status": "ok"})


def ready(request):
    checks: dict[str, str] = {}
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        checks["postgres"] = "ok"
    except Exception:
        checks["postgres"] = "error"
    try:
        cache.set("health:ping", "1", timeout=5)
        checks["redis"] = "ok" if cache.get("health:ping") == "1" else "error"
    except Exception:
        checks["redis"] = "error"
    healthy = all(v == "ok" for v in checks.values())
    return JsonResponse({"status": "ok" if healthy else "error", "checks": checks}, status=200 if healthy else 503)
