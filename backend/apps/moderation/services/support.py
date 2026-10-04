"""Support requests: forwarded by email to SUPPORT_EMAIL; replying answers the user directly."""

from django.conf import settings
from django.db import transaction

from apps.users.models import User
from common import analytics
from common.exceptions import ValidationFailed

TOPICS = ("QUESTION", "BUG", "IDEA", "SAFETY", "OTHER")


def send_support_message(user: User, *, topic: str, message: str, page: str = "") -> None:
    from apps.moderation.tasks import send_support_email

    message = message.strip()
    if not message:
        raise ValidationFailed(details={"message": ["Опишіть звернення."]})
    if not settings.SUPPORT_EMAIL:
        raise ValidationFailed("Support is not configured", code="SUPPORT_UNAVAILABLE")
    profile = getattr(user, "profile", None)
    name = profile.display_name if profile else ""
    subject = f"[Poruch support] {topic}: {message.splitlines()[0][:60]}"
    body = "\n".join(
        [
            message,
            "",
            "—",
            f"From: {name} <{user.email}>",
            f"User ID: {user.pk}",
            f"Topic: {topic}",
            f"Page: {page or '-'}",
        ]
    )
    transaction.on_commit(lambda: send_support_email.delay(subject, body, user.email))
    analytics.track(user_id=user.id, event="support_message_sent", properties={"topic": topic})
