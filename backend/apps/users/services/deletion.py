"""Account deletion (App Store 5.1.1(v), Google Play account-deletion policy).

Personal data is erased; records other people still need (their chats, the requests they helped
with, reviews they received) are kept but no longer point to anyone: the name becomes
«Видалений користувач», texts are replaced and exact places are blurred.
"""

import logging

from django.contrib.gis.geos import Point
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.users.models import User
from common import analytics
from common.exceptions import ValidationFailed

logger = logging.getLogger(__name__)

# ~1 km: enough to keep a past request on the map of the people involved, not enough to find a home.
BLUR_DEGREES = 0.01


def _blur(point: Point) -> Point:
    return Point(round(point.x / BLUR_DEGREES) * BLUR_DEGREES, round(point.y / BLUR_DEGREES) * BLUR_DEGREES, srid=4326)


def delete_account(user: User, password: str | None = None) -> None:
    """Erase the account. A password account must confirm with its password."""
    if user.has_usable_password() and not user.check_password(password or ""):
        raise ValidationFailed(details={"password": [_("Неправильний пароль.")]})
    user_id = user.pk
    files = _erase(user)
    # Files go after the database is committed, so a failed transaction never leaves broken links.
    transaction.on_commit(lambda: _delete_files(files))
    analytics.track(user_id=None, event="user_deleted", properties={})
    logger.info("account_deleted", extra={"user_id": str(user_id)})


@transaction.atomic
def _erase(user: User) -> list[str]:
    from apps.conversations.models import Message
    from apps.help_requests.models import HelpRequest
    from apps.locations.models import Availability
    from apps.media.models import Media
    from apps.moderation.models import UserBlock
    from apps.notifications.models import Notification, NotificationPreference
    from apps.reputation.models import Review, ThankYou
    from apps.users.models import Profile, SocialAccount, UserCapability
    from apps.users.services.profile import deactivate_user

    deactivate_user(user)  # cancels open requests and offers, drops push subscriptions and sessions
    user = User.objects.select_for_update().get(pk=user.pk)

    # Photos: avatar, request photos, chat photos — rows here, files after commit.
    media = list(Media.objects.filter(owner=user))
    files = [k for m in media for k in (m.original_key, m.key, m.thumbnail_key) if k]
    Media.objects.filter(owner=user).delete()

    Message.objects.filter(sender=user).exclude(message_type=Message.Type.SYSTEM).update(
        text=_("Повідомлення видалено"), message_type=Message.Type.TEXT
    )
    for request in HelpRequest.objects.filter(author=user):
        request.title = _("Запит видалено")
        request.description = _("Автор видалив свій акаунт.")
        request.place_name = ""
        request.location = _blur(request.location)
        request.save(update_fields=["title", "description", "place_name", "location"])

    Review.objects.filter(to_user=user).delete()
    ThankYou.objects.filter(to_user=user).delete()
    UserBlock.objects.filter(blocker=user).delete()
    UserBlock.objects.filter(blocked=user).delete()
    Notification.objects.filter(user=user).delete()
    NotificationPreference.objects.filter(user=user).delete()
    Availability.objects.filter(user=user).delete()
    UserCapability.objects.filter(user=user).delete()
    SocialAccount.objects.filter(user=user).delete()
    Profile.objects.filter(user=user).update(
        display_name=_("Видалений користувач"),
        avatar=None,
        city=None,
        custom_items=[],
        show_name=True,  # others see «Видалений користувач», not «Анонім»
        show_avatar=False,
        helped_count=0,
        thanks_received_count=0,
        reviews_count=0,
        rating_sum=0,
    )

    user.email = f"deleted-{user.pk}@deleted.invalid"
    user.pending_email = ""
    user.phone_encrypted = ""
    user.phone_hash = ""
    user.phone_verified = False
    user.email_verified = False
    user.last_seen_at = None
    user.set_unusable_password()
    user.is_active = False
    user.deleted_at = timezone.now()
    user.save()
    return files


def _delete_files(keys: list[str]) -> None:
    from apps.media import storage

    if not keys:
        return
    try:
        storage.delete(*keys)
    except Exception:
        logger.warning("account_files_delete_failed", extra={"count": len(keys)})
