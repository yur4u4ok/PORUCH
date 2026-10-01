from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.contrib.postgres.fields import ArrayField
from django.db import models

from apps.help_requests.constants import NOTIFICATION_CATEGORIES
from common.models import UUIDModel


def default_categories() -> list[str]:
    return [c.value for c in NOTIFICATION_CATEGORIES]


class NotificationType(models.TextChoices):
    NEW_NEARBY_REQUEST = "NEW_NEARBY_REQUEST", "Новий запит поруч"
    HELP_RESPONSE_RECEIVED = "HELP_RESPONSE_RECEIVED", "Отримано відгук"
    HELP_RESPONSE_ACCEPTED = "HELP_RESPONSE_ACCEPTED", "Відгук прийнято"
    HELP_RESPONSE_REJECTED = "HELP_RESPONSE_REJECTED", "Відгук відхилено"
    NEW_MESSAGE = "NEW_MESSAGE", "Нове повідомлення"
    REQUEST_COMPLETED = "REQUEST_COMPLETED", "Запит завершено"
    THANK_YOU_RECEIVED = "THANK_YOU_RECEIVED", "Отримано подяку"
    REQUEST_EXPIRING = "REQUEST_EXPIRING", "Запит скоро завершиться"
    REQUEST_CANCELLED = "REQUEST_CANCELLED", "Запит скасовано"


class PushSubscription(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subscriptions")
    endpoint = models.TextField(unique=True)
    p256dh = models.TextField()
    auth = models.TextField()
    user_agent = models.CharField(max_length=255, blank=True)
    failure_count = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "push-підписка"
        verbose_name_plural = "push-підписки"

    def __str__(self) -> str:
        return f"Push subscription {self.pk}"


class Notification(UUIDModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications", db_index=True
    )
    type = models.CharField(max_length=40, choices=NotificationType.choices)
    title = models.CharField(max_length=200)
    body = models.CharField(max_length=500, blank=True)
    url = models.CharField(max_length=255, blank=True)
    data = models.JSONField(default=dict, blank=True)
    help_request = models.ForeignKey(
        "help_requests.HelpRequest", null=True, blank=True, on_delete=models.CASCADE, related_name="+"
    )
    dedupe_key = models.CharField(max_length=200, null=True, blank=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    push_sent_at = models.DateTimeField(null=True, blank=True)
    push_opened_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "сповіщення"
        verbose_name_plural = "сповіщення"
        indexes = [models.Index(fields=["user", "-created_at"], name="notif_user_created_idx")]

    def __str__(self) -> str:
        return f"{self.type} → {self.user_id}"


class NotificationPreference(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_preference", primary_key=True
    )
    notification_radius = models.PositiveIntegerField(default=3000)
    enabled_categories = ArrayField(models.CharField(max_length=20), default=default_categories, blank=True)
    push_enabled = models.BooleanField(default=True)
    email_enabled = models.BooleanField(default=False)
    # Last location explicitly shared by the user in the foreground (no background tracking).
    location = gis_models.PointField(geography=True, srid=4326, null=True, blank=True)
    location_updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "налаштування сповіщень"
        verbose_name_plural = "налаштування сповіщень"

    def __str__(self) -> str:
        return f"Preferences of {self.user_id}"
