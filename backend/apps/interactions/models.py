from django.conf import settings
from django.core.validators import MaxLengthValidator
from django.db import models
from django.db.models import Q

from apps.interactions.constants import ResponseStatus
from common.models import UUIDModel


class HelpResponse(UUIDModel):
    Status = ResponseStatus

    help_request = models.ForeignKey(
        "help_requests.HelpRequest", on_delete=models.CASCADE, related_name="responses", db_index=True
    )
    helper = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="help_responses", db_index=True
    )
    message = models.TextField(max_length=500, blank=True, validators=[MaxLengthValidator(500)])
    status = models.CharField(max_length=10, choices=ResponseStatus.choices, default=ResponseStatus.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name = "відгук"
        verbose_name_plural = "відгуки"
        constraints = [
            models.UniqueConstraint(
                fields=["help_request", "helper"],
                condition=Q(status__in=["PENDING", "ACCEPTED"]),
                name="unique_active_response_per_user_request",
            ),
            models.UniqueConstraint(
                fields=["help_request"],
                condition=Q(status="ACCEPTED"),
                name="single_accepted_response_per_request",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.helper_id} → {self.help_request_id} ({self.status})"
