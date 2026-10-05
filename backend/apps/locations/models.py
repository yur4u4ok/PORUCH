from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.db.models import Q
from django.utils import timezone

from common.models import UUIDModel


class City(UUIDModel):
    name = models.CharField(max_length=100)
    # Localized names, e.g. {"en": "Lviv", "pl": "Lwów"}; `name` is the Ukrainian default.
    translations = models.JSONField(default=dict, blank=True)
    slug = models.SlugField(unique=True)
    country_code = models.CharField(max_length=2)
    center = gis_models.PointField(geography=True, srid=4326)
    default_zoom = models.PositiveSmallIntegerField(default=12)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)

    class Meta:
        ordering = ["name"]
        verbose_name = "місто"
        verbose_name_plural = "міста"
        constraints = [
            models.UniqueConstraint(fields=["is_default"], condition=Q(is_default=True), name="single_default_city"),
        ]

    def __str__(self) -> str:
        return self.name


class AvailabilityQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True, expires_at__gt=timezone.now())


class Availability(models.Model):
    """Temporary «Я зараз можу допомогти» status."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="availability", primary_key=True
    )
    is_active = models.BooleanField(default=False)
    location = gis_models.PointField(geography=True, srid=4326, null=True, blank=True)
    radius = models.PositiveIntegerField(default=3000)
    categories = ArrayField(models.CharField(max_length=20), default=list, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = AvailabilityQuerySet.as_manager()

    class Meta:
        verbose_name = "доступність"
        verbose_name_plural = "доступність"
        indexes = [
            models.Index(fields=["is_active", "expires_at"]),
            gis_models.Index(fields=["location"], name="availability_location_gist"),
        ]

    def __str__(self) -> str:
        return f"Availability of {self.user_id}"

    @property
    def is_currently_active(self) -> bool:
        return bool(self.is_active and self.expires_at and self.expires_at > timezone.now())
