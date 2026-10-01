from django.conf import settings
from django.db import models

from common.models import UUIDModel


class Media(UUIDModel):
    class Kind(models.TextChoices):
        AVATAR = "AVATAR", "Аватар"
        HELP_REQUEST = "HELP_REQUEST", "Фото запиту"
        CHAT = "CHAT", "Фото в чаті"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Очікує завантаження"
        READY = "READY", "Готово"
        FAILED = "FAILED", "Помилка"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="media")
    kind = models.CharField(max_length=20, choices=Kind.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    declared_content_type = models.CharField(max_length=50)
    declared_size = models.PositiveIntegerField()
    original_key = models.CharField(max_length=255)
    key = models.CharField(max_length=255, blank=True)
    thumbnail_key = models.CharField(max_length=255, blank=True)
    content_type = models.CharField(max_length=50, blank=True)
    size = models.PositiveIntegerField(null=True, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    is_attached = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "медіафайл"
        verbose_name_plural = "медіафайли"
        indexes = [models.Index(fields=["status", "is_attached", "created_at"])]

    def __str__(self) -> str:
        return f"{self.kind}:{self.id}"
