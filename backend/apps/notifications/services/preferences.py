from django.utils import timezone
from django.utils.translation import gettext as _

from apps.help_requests.constants import NOTIFICATION_CATEGORIES
from apps.notifications.models import NotificationPreference
from apps.users.models import User
from common.exceptions import ValidationFailed
from common.utils.geo import normalize_radius, validate_coordinates


def create_default_preferences(user: User) -> NotificationPreference:
    prefs, _created = NotificationPreference.objects.get_or_create(user=user)
    return prefs


def get_preferences(user: User) -> NotificationPreference:
    return create_default_preferences(user)


def update_preferences(user: User, data: dict) -> NotificationPreference:
    prefs = get_preferences(user)
    fields: list[str] = []
    if "notification_radius" in data:
        prefs.notification_radius = normalize_radius(data["notification_radius"])
        fields.append("notification_radius")
    if "enabled_categories" in data:
        allowed = {c.value for c in NOTIFICATION_CATEGORIES}
        categories = list(dict.fromkeys(data["enabled_categories"]))
        if set(categories) - allowed:
            raise ValidationFailed(details={"enabled_categories": [_("Невідома категорія.")]})
        prefs.enabled_categories = categories
        fields.append("enabled_categories")
    for name in ("push_enabled", "email_enabled"):
        if name in data:
            setattr(prefs, name, bool(data[name]))
            fields.append(name)
    if data.get("location"):
        loc = data["location"]
        coords = validate_coordinates(loc.get("latitude"), loc.get("longitude"), loc.get("accuracy"))
        prefs.location = coords.to_point()
        prefs.location_updated_at = timezone.now()
        fields += ["location", "location_updated_at"]
    if fields:
        prefs.save(update_fields=fields)
    return prefs
