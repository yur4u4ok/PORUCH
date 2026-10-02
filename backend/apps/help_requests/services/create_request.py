from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.help_requests.constants import SUBCATEGORIES, Category, RewardType, Urgency
from apps.help_requests.models import HelpRequest
from apps.users.models import User
from common import analytics
from common.exceptions import ValidationFailed
from common.utils.geo import validate_coordinates


def expiration_for(urgency: str, now=None):
    now = now or timezone.now()
    hours = settings.HELP_REQUEST_EXPIRATION_HOURS.get(urgency, settings.HELP_REQUEST_DEFAULT_EXPIRATION_HOURS)
    return now + timedelta(hours=hours)


def derive_title(description: str) -> str:
    first_line = description.strip().splitlines()[0] if description.strip() else ""
    return first_line[:117] + "..." if len(first_line) > 120 else first_line


def validate_reward(reward_type: str, reward_amount: Decimal | None) -> Decimal | None:
    if reward_type != RewardType.WILLING:
        return None  # amount is only informative and only for «Готовий(-а) віддячити»
    if reward_amount is None or reward_amount <= 0:
        raise ValidationFailed(details={"reward_amount": [_("Вкажіть суму подяки.")]})
    return reward_amount


def validate_subcategory(category: str, subcategory: str | None) -> str | None:
    if not subcategory:
        return None
    if subcategory not in SUBCATEGORIES.get(category, []):
        raise ValidationFailed(details={"subcategory": [_("Невідома підкатегорія.")]})
    return subcategory


@transaction.atomic
def create_help_request(
    author: User,
    *,
    category: str,
    description: str,
    location: dict,
    urgency: str,
    reward_type: str = RewardType.NONE,
    reward_amount: Decimal | None = None,
    title: str | None = None,
    subcategory: str | None = None,
    photo_ids: list | None = None,
    emergency_acknowledged: bool = False,
) -> HelpRequest:
    from apps.media.services.media import get_ready_media_list

    coords = validate_coordinates(location.get("latitude"), location.get("longitude"), location.get("accuracy"))
    if category == Category.URGENT and not emergency_acknowledged:
        raise ValidationFailed(
            _("Потрібно підтвердити попередження про екстрені служби."),
            code="EMERGENCY_ACK_REQUIRED",
            details={"emergency_acknowledged": [_("Підтвердіть, що ознайомились із попередженням.")]},
        )
    description = description.strip()
    if not description:
        raise ValidationFailed(details={"description": [_("Опишіть, що сталося.")]})
    photo_ids = photo_ids or []
    if len(photo_ids) > settings.HELP_REQUEST_MAX_PHOTOS:
        raise ValidationFailed(
            details={"photo_ids": [_("Максимум {n} фото.").format(n=settings.HELP_REQUEST_MAX_PHOTOS)]}
        )
    if category == Category.URGENT:
        urgency = Urgency.NOW
    photos = get_ready_media_list(author, photo_ids, kind="HELP_REQUEST")
    now = timezone.now()
    help_request = HelpRequest.objects.create(
        author=author,
        category=category,
        subcategory=validate_subcategory(category, subcategory),
        title=(title or "").strip()[:120] or derive_title(description),
        description=description,
        location=coords.to_point(),
        location_accuracy=coords.accuracy,
        urgency=urgency,
        reward_type=reward_type,
        reward_amount=validate_reward(reward_type, reward_amount),
        expires_at=expiration_for(urgency, now),
    )
    if photos:
        help_request.photos.set(photos)

    from apps.notifications.services.preferences import get_preferences

    # Remember the explicitly shared location for future notification matching.
    prefs = get_preferences(author)
    prefs.location = coords.to_point()
    prefs.location_updated_at = now
    prefs.save(update_fields=["location", "location_updated_at"])

    analytics.track(
        user_id=author.id,
        event="help_requests_created",
        properties={"help_request_id": help_request.id, "category": category, "urgency": urgency},
    )
    from apps.notifications.tasks import send_nearby_help_notifications

    request_id = str(help_request.id)
    transaction.on_commit(lambda: send_nearby_help_notifications.delay(request_id))
    return help_request
