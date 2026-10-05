from django.conf import settings
from django.core.validators import MaxLengthValidator
from django.db import models
from django.db.models import F, Q

from common.models import UUIDModel


class Report(UUIDModel):
    class Reason(models.TextChoices):
        SPAM = "SPAM", "Спам"
        FRAUD = "FRAUD", "Шахрайство"
        HARASSMENT = "HARASSMENT", "Переслідування"
        DANGEROUS = "DANGEROUS", "Небезпечно"
        INAPPROPRIATE = "INAPPROPRIATE", "Неприйнятний вміст"
        OTHER = "OTHER", "Інше"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Відкрита"
        IN_REVIEW = "IN_REVIEW", "Розглядається"
        RESOLVED = "RESOLVED", "Вирішена"
        DISMISSED = "DISMISSED", "Відхилена"

    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reports_made")
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="reports_received"
    )
    help_request = models.ForeignKey(
        "help_requests.HelpRequest", null=True, blank=True, on_delete=models.CASCADE, related_name="reports"
    )
    message = models.ForeignKey(
        "conversations.Message", null=True, blank=True, on_delete=models.CASCADE, related_name="reports"
    )
    reason = models.CharField(max_length=20, choices=Reason.choices)
    description = models.TextField(max_length=1000, blank=True, validators=[MaxLengthValidator(1000)])
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN, db_index=True)
    moderator_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "скарга"
        verbose_name_plural = "скарги"
        constraints = [
            models.CheckConstraint(
                condition=Q(target_user__isnull=False) | Q(help_request__isnull=False) | Q(message__isnull=False),
                name="report_has_target",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.reason} ({self.status})"


class UserBlock(models.Model):
    blocker = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="blocks_made")
    blocked = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="blocks_received")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "блокування"
        verbose_name_plural = "блокування"
        constraints = [
            models.UniqueConstraint(fields=["blocker", "blocked"], name="unique_block_pair"),
            models.CheckConstraint(condition=~Q(blocker=F("blocked")), name="block_not_self"),
        ]

    def __str__(self) -> str:
        return f"{self.blocker_id} ⛔ {self.blocked_id}"
