from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.core.validators import MaxLengthValidator, MinValueValidator
from django.db import models
from django.db.models import Q

from apps.help_requests.constants import (
    CLOSED_STATUSES,
    Category,
    HelpRequestStatus,
    RewardType,
    Urgency,
)
from common.models import TimeStampedModel


class HelpRequest(TimeStampedModel):
    Status = HelpRequestStatus

    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="help_requests")
    category = models.CharField(max_length=20, choices=Category.choices, db_index=True)
    subcategory = models.CharField(max_length=40, null=True, blank=True)

    title = models.CharField(max_length=120)
    description = models.TextField(max_length=1000, validators=[MaxLengthValidator(1000)])

    location = gis_models.PointField(geography=True, srid=4326)  # GIST index created by GeoDjango
    location_accuracy = models.FloatField(null=True, blank=True)

    urgency = models.CharField(max_length=10, choices=Urgency.choices, db_index=True)

    reward_type = models.CharField(max_length=10, choices=RewardType.choices, default=RewardType.NONE)
    reward_amount = models.DecimalField(
        null=True, blank=True, max_digits=10, decimal_places=2, validators=[MinValueValidator(0)]
    )

    status = models.CharField(
        max_length=12, choices=HelpRequestStatus.choices, default=HelpRequestStatus.ACTIVE, db_index=True
    )

    expires_at = models.DateTimeField(db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    in_progress_at = models.DateTimeField(null=True, blank=True)
    first_response_at = models.DateTimeField(null=True, blank=True)
    expiring_notified_at = models.DateTimeField(null=True, blank=True)

    selected_helper = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="helped_requests",
    )
    photos = models.ManyToManyField("media.Media", blank=True, related_name="+")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "запит про допомогу"
        verbose_name_plural = "запити про допомогу"
        indexes = [
            models.Index(fields=["status", "expires_at"], name="hr_status_expires_idx"),
            models.Index(fields=["author", "status"], name="hr_author_status_idx"),
            models.Index(fields=["selected_helper", "status"], name="hr_helper_status_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(reward_amount__isnull=True) | Q(reward_amount__gte=0),
                name="hr_reward_amount_non_negative",
            ),
            models.CheckConstraint(
                condition=~Q(status__in=["IN_PROGRESS", "COMPLETED"]) | Q(selected_helper__isnull=False),
                name="hr_in_progress_has_helper",
            ),
        ]

    def __str__(self) -> str:
        return self.title

    @property
    def is_closed(self) -> bool:
        return self.status in CLOSED_STATUSES
