from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.help_requests.constants import NOTIFICATION_CATEGORIES
from apps.locations.models import Availability
from apps.users.models import User
from common import analytics
from common.exceptions import ValidationFailed
from common.utils.geo import normalize_radius, validate_coordinates


@transaction.atomic
def set_availability(
    user: User,
    *,
    latitude,
    longitude,
    accuracy=None,
    radius=None,
    categories: list[str] | None = None,
    duration_minutes: int | None = None,
) -> Availability:
    coords = validate_coordinates(latitude, longitude, accuracy)
    radius_m = normalize_radius(radius)
    minutes = duration_minutes or settings.AVAILABILITY_DEFAULT_HOURS * 60
    if minutes > settings.AVAILABILITY_MAX_HOURS * 60:
        raise ValidationFailed(
            details={"duration_minutes": [_("Максимум {h} год.").format(h=settings.AVAILABILITY_MAX_HOURS)]}
        )
    if categories is None:
        from apps.notifications.services.preferences import get_preferences

        categories = list(get_preferences(user).enabled_categories) or [c.value for c in NOTIFICATION_CATEGORIES]
    availability, _created = Availability.objects.select_for_update().get_or_create(user=user)
    availability.is_active = True
    availability.location = coords.to_point()
    availability.radius = radius_m
    availability.categories = list(dict.fromkeys(categories))
    availability.expires_at = timezone.now() + timedelta(minutes=minutes)
    availability.save()
    analytics.track(user_id=user.id, event="availability_enabled", properties={"radius": radius_m})
    return availability


def deactivate_availability(user: User) -> None:
    Availability.objects.filter(user=user, is_active=True).update(is_active=False)


def get_availability(user: User) -> Availability | None:
    return Availability.objects.filter(user=user).first()


def expire_availability() -> int:
    return Availability.objects.filter(is_active=True, expires_at__lte=timezone.now()).update(is_active=False)
