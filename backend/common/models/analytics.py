from django.db import models

from .base import UUIDModel


class AnalyticsEvent(UUIDModel):
    """Raw product event. Lightweight sink for KPIs; can be replaced by PostHog etc."""

    event = models.CharField(max_length=100, db_index=True)
    user_id = models.UUIDField(null=True, blank=True, db_index=True)
    properties = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.event} @ {self.created_at:%Y-%m-%d %H:%M}"
