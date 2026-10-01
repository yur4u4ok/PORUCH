"""Smart nearby-help notifications (PostGIS matching + anti-spam)."""

import logging

from django.conf import settings
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.db.models import Exists, F, OuterRef, Q
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.help_requests.constants import Category, HelpRequestStatus, Urgency
from apps.help_requests.models import HelpRequest
from apps.interactions.models import HelpResponse
from apps.moderation.selectors import blocked_user_ids
from apps.notifications.models import NotificationType, PushSubscription
from apps.notifications.services.notify import notify
from apps.notifications.services.texts import CATEGORY_PHRASES, URGENCY_PHRASES, format_distance
from apps.users.models import User
from common.utils import rate_limit

logger = logging.getLogger(__name__)

HOUR = 60 * 60


def is_high_urgency(help_request: HelpRequest) -> bool:
    return help_request.urgency == Urgency.NOW or help_request.category == Category.URGENT


def find_recipients(help_request: HelpRequest):
    """Users whose notification area or active availability covers the request.

    All geo filtering is done in PostgreSQL (ST_DWithin + ST_Distance).
    """
    point = help_request.location
    now = timezone.now()
    max_radius = D(m=settings.NEARBY_MAX_RADIUS)
    category = help_request.category

    via_preferences = (
        Q(notification_preference__location__dwithin=(point, max_radius))
        & Q(notification_preference__enabled_categories__contains=[category])
        & Q(pref_distance__lte=F("notification_preference__notification_radius"))
    )
    via_availability = (
        Q(availability__is_active=True)
        & Q(availability__expires_at__gt=now)
        & Q(availability__location__dwithin=(point, max_radius))
        & Q(availability__categories__contains=[category])
        & Q(avail_distance__lte=F("availability__radius"))
    )
    has_subscription = PushSubscription.objects.filter(user=OuterRef("pk"))
    already_responded = HelpResponse.objects.filter(help_request=help_request, helper=OuterRef("pk"))

    return (
        User.objects.filter(is_active=True, email_verified=True, notification_preference__push_enabled=True)
        .exclude(pk=help_request.author_id)
        .exclude(pk__in=blocked_user_ids(help_request.author))
        .annotate(
            pref_distance=Distance("notification_preference__location", point),
            avail_distance=Distance("availability__location", point),
            has_subscription=Exists(has_subscription),
            already_responded=Exists(already_responded),
        )
        .filter(has_subscription=True, already_responded=False)
        .filter(via_preferences | via_availability)
    )


def _within_rate_limit(user_id, high_urgency: bool) -> bool:
    if high_urgency:
        return rate_limit.hit(f"notif:urgent:{user_id}", settings.NOTIFICATION_URGENT_LIMIT_PER_HOUR, HOUR)
    return rate_limit.hit(f"notif:nearby:{user_id}", settings.NOTIFICATION_NEARBY_LIMIT_PER_HOUR, HOUR)


def notify_users_about_help_request(help_request: HelpRequest) -> int:
    help_request.refresh_from_db()
    if help_request.status != HelpRequestStatus.ACTIVE or help_request.expires_at <= timezone.now():
        return 0
    high = is_high_urgency(help_request)
    title = _("🆘 Комусь поруч потрібна допомога")
    category_text = str(CATEGORY_PHRASES.get(Category(help_request.category), CATEGORY_PHRASES[Category.OTHER]))
    urgency_text = str(URGENCY_PHRASES.get(Urgency(help_request.urgency), ""))
    sent = 0
    for user in find_recipients(help_request).iterator():
        distances = [d.m for d in (user.pref_distance, user.avail_distance) if d is not None]
        distance = min(distances) if distances else None
        if not _within_rate_limit(user.pk, high):
            continue
        body = "\n".join(filter(None, [category_text, f"📍 {format_distance(distance)}", urgency_text]))
        created = notify(
            user,
            NotificationType.NEW_NEARBY_REQUEST,
            title=title,
            body=body,
            url=f"/help/{help_request.id}",
            help_request=help_request,
            data={"help_request_id": str(help_request.id), "distance_m": round(distance) if distance else None},
            dedupe_key=f"nearby:{help_request.id}:{user.pk}",
        )
        if created:
            sent += 1
    logger.info("nearby_notifications_queued", extra={"help_request_id": str(help_request.id), "count": sent})
    return sent
