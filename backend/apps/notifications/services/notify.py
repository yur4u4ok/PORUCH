"""Create in-app notifications and queue Web Push delivery (never synchronously)."""

from django.db import IntegrityError, transaction
from django.utils.translation import gettext as _

from apps.notifications.models import Notification, NotificationPreference, NotificationType
from apps.users.models import User

EMAIL_TYPES = {
    NotificationType.HELP_RESPONSE_RECEIVED,
    NotificationType.HELP_RESPONSE_ACCEPTED,
    NotificationType.REQUEST_COMPLETED,
    NotificationType.THANK_YOU_RECEIVED,
}


def notify(
    user: User,
    type: str,
    *,
    title: str,
    body: str = "",
    url: str = "",
    help_request=None,
    data: dict | None = None,
    dedupe_key: str | None = None,
    push: bool = True,
) -> Notification | None:
    if not user.is_active:
        return None
    try:
        with transaction.atomic():
            notification = Notification.objects.create(
                user=user,
                type=type,
                title=title,
                body=body,
                url=url,
                help_request=help_request,
                data=data or {},
                dedupe_key=dedupe_key,
            )
    except IntegrityError:
        return None  # duplicate (dedupe_key) — already notified
    prefs = NotificationPreference.objects.filter(user=user).first()
    if push and (prefs is None or prefs.push_enabled):
        queue_push(notification)
    if prefs and prefs.email_enabled and type in EMAIL_TYPES:
        from common.emails import send_service_email

        send_service_email(
            user.email,
            title,
            heading=title,
            paragraphs=[body] if body else [],
            button_text=_("Відкрити в Poruch"),
            button_url=url or "/",
            note=_("Сповіщення на пошту можна вимкнути в налаштуваннях застосунку."),
        )
    return notification


def queue_push(notification: Notification) -> None:
    from apps.notifications.tasks import send_push_notification

    notification_id = str(notification.id)
    transaction.on_commit(lambda: send_push_notification.delay(notification_id))
