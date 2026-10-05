"""Backend product analytics abstraction.

Usage::

    analytics.track(user_id=user.id, event="help_request_created", properties={...})

Backends are configured with settings.ANALYTICS_BACKENDS. A PostHog backend can be
added later without touching call sites.
"""

import logging
from functools import lru_cache
from typing import Any, Protocol
from uuid import UUID

from django.conf import settings
from django.db import transaction
from django.utils.module_loading import import_string

logger = logging.getLogger("analytics")


class AnalyticsBackend(Protocol):
    def track(self, user_id: UUID | None, event: str, properties: dict[str, Any]) -> None: ...


class LoggingBackend:
    def track(self, user_id, event, properties):
        logger.info("analytics_event", extra={"event": event, "user_id": str(user_id or ""), "properties": properties})


class DatabaseBackend:
    def track(self, user_id, event, properties):
        from common.models import AnalyticsEvent

        AnalyticsEvent.objects.create(user_id=user_id, event=event, properties=properties)


@lru_cache(maxsize=1)
def _backends() -> list[AnalyticsBackend]:
    return [import_string(path)() for path in settings.ANALYTICS_BACKENDS]


def track(*, user_id: UUID | None, event: str, properties: dict[str, Any] | None = None) -> None:
    props = {k: (str(v) if isinstance(v, UUID) else v) for k, v in (properties or {}).items()}

    def _send() -> None:
        for backend in _backends():
            try:
                backend.track(user_id, event, props)
            except Exception:  # analytics must never break business flows
                logger.exception("analytics_backend_failed", extra={"event": event})

    transaction.on_commit(_send)
