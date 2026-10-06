"""Web Push delivery through pywebpush (VAPID)."""

import json
import logging

from django.conf import settings
from django.db.models import F
from django.utils import timezone
from pywebpush import WebPushException, webpush

from apps.notifications.models import Notification, PushSubscription
from common import analytics

logger = logging.getLogger(__name__)

GONE_STATUSES = {404, 410}
MAX_FAILURES = 3


def build_payload(notification: Notification) -> dict:
    url = notification.url or "/"
    separator = "&" if "?" in url else "?"
    return {
        "title": notification.title,
        "body": notification.body,
        "url": f"{url}{separator}n={notification.id}",
        "notification_id": str(notification.id),
        "type": notification.type,
        "tag": notification.dedupe_key or str(notification.id),
    }


def send_to_subscription(subscription: PushSubscription, payload: dict) -> bool:
    try:
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
            },
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
            ttl=settings.PUSH_TTL_SECONDS,
            # Without "high", Android/FCM treats pushes as low priority: delayed while the phone
            # sleeps and shown without a heads-up popup when the app is closed.
            headers={"Urgency": "high"},
            timeout=10,
        )
    except WebPushException as exc:
        status = getattr(exc.response, "status_code", None)
        if status in GONE_STATUSES:
            subscription.delete()
            logger.info("push_subscription_gone", extra={"subscription_id": subscription.pk})
        else:
            PushSubscription.objects.filter(pk=subscription.pk).update(failure_count=F("failure_count") + 1)
            logger.warning("push_failed", extra={"status": status, "subscription_id": subscription.pk})
        return False
    PushSubscription.objects.filter(pk=subscription.pk).update(last_used_at=timezone.now(), failure_count=0)
    return True


def deliver(notification_id) -> int:
    """Send push for a notification exactly once. Returns number of successful deliveries."""
    claimed = Notification.objects.filter(id=notification_id, push_sent_at__isnull=True).update(
        push_sent_at=timezone.now()
    )
    if not claimed:
        return 0  # already sent (duplicate task)
    notification = Notification.objects.select_related("help_request").get(id=notification_id)
    hr = notification.help_request
    if (
        notification.type == "NEW_NEARBY_REQUEST"
        and hr is not None
        and (hr.status != "ACTIVE" or hr.expires_at <= timezone.now())
    ):
        return 0  # do not push for closed/expired requests
    if not settings.VAPID_PRIVATE_KEY:
        logger.warning("push_not_configured")
        return 0
    payload = build_payload(notification)
    sent = 0
    for subscription in PushSubscription.objects.filter(user_id=notification.user_id, failure_count__lt=MAX_FAILURES):
        if send_to_subscription(subscription, payload):
            sent += 1
    if sent:
        analytics.track(user_id=notification.user_id, event="push_sent", properties={"type": notification.type})
    return sent


def cleanup_invalid_subscriptions() -> int:
    deleted, _ = PushSubscription.objects.filter(failure_count__gte=MAX_FAILURES).delete()
    return deleted
