"""Structured JSON logging with request context (request_id, user_id)."""

import contextvars
import json
import logging
from datetime import UTC, datetime

request_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("request_id", default=None)
user_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("user_id", default=None)

_RESERVED = set(vars(logging.LogRecord("", 0, "", 0, "", (), None)).keys()) | {"message", "asctime"}
_SENSITIVE = {"password", "token", "access", "refresh", "auth", "p256dh", "secret", "authorization"}


def _scrub(value):
    if isinstance(value, dict):
        return {k: ("***" if k.lower() in _SENSITIVE else _scrub(v)) for k, v in value.items()}
    if isinstance(value, list | tuple):
        return [_scrub(v) for v in value]
    return value


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = getattr(record, "request_id", None) or request_id_var.get()
        record.user_id = getattr(record, "user_id", None) or user_id_var.get()
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_") and value is not None:
                payload[key] = _scrub(value)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=False)
