import logging
import time
import uuid

from .logging import request_id_var, user_id_var

logger = logging.getLogger("http")


class RequestLoggingMiddleware:
    """Attach a request id and log endpoint, status code and duration (never bodies)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        request.request_id = request_id
        rid_token = request_id_var.set(request_id)
        uid_token = user_id_var.set(None)
        started = time.perf_counter()
        status_code = 500
        try:
            response = self.get_response(request)
            status_code = response.status_code
            response["X-Request-ID"] = request_id
            return response
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000, 1)
            user = getattr(request, "user", None)
            user_id = str(user.pk) if user is not None and user.is_authenticated else None
            if not request.path.startswith(("/static/", "/health/")):
                logger.info(
                    "request",
                    extra={
                        "endpoint": request.path,
                        "method": request.method,
                        "status_code": status_code,
                        "duration_ms": duration_ms,
                        "user_id": user_id,
                    },
                )
            request_id_var.reset(rid_token)
            user_id_var.reset(uid_token)
