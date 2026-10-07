"""Update / cancel / complete / expire."""

from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.help_requests.constants import HelpRequestStatus
from apps.help_requests.models import HelpRequest
from apps.help_requests.services.create_request import validate_reward
from apps.interactions.constants import ResponseStatus
from apps.interactions.models import HelpResponse
from apps.notifications.models import NotificationType
from apps.notifications.services.notify import notify
from apps.users.models import Profile, User
from common import analytics
from common.exceptions import Forbidden, InvalidState, NotFound, ValidationFailed

EDITABLE_FIELDS = {"title", "description", "reward_type", "reward_amount", "reward_options", "reward_currency"}


def _lock_own(author: User, help_request_id) -> HelpRequest:
    help_request = HelpRequest.objects.select_for_update().filter(id=help_request_id).first()
    if help_request is None:
        raise NotFound()
    if help_request.author_id != author.pk:
        raise Forbidden(_("Тільки автор може змінювати запит."), code="NOT_AUTHOR")
    return help_request


@transaction.atomic
def update_help_request(author: User, help_request_id, data: dict) -> HelpRequest:
    from apps.media.services.media import get_ready_media_list

    help_request = _lock_own(author, help_request_id)
    if help_request.status != HelpRequestStatus.ACTIVE:
        raise InvalidState(_("Редагувати можна тільки активний запит."), code="REQUEST_NOT_ACTIVE")
    fields = []
    for name in EDITABLE_FIELDS & data.keys():
        value = data[name]
        if name in ("title", "description"):
            value = (value or "").strip()
            if not value:
                raise ValidationFailed(details={name: [_("Поле не може бути порожнім.")]})
        setattr(help_request, name, value)
        fields.append(name)
    if {"reward_type", "reward_amount", "reward_options"} & data.keys():
        help_request.reward_amount, help_request.reward_options = validate_reward(
            help_request.reward_type, help_request.reward_amount, help_request.reward_options
        )
        fields += ["reward_amount", "reward_options"]
    if "photo_ids" in data:
        photo_ids = data["photo_ids"] or []
        if len(photo_ids) > settings.HELP_REQUEST_MAX_PHOTOS:
            raise ValidationFailed(details={"photo_ids": [_("Максимум 5 фото.")]})
        help_request.photos.set(get_ready_media_list(author, photo_ids, kind="HELP_REQUEST"))
    if fields:
        help_request.save(update_fields=list(set(fields)) + ["updated_at"])
    return help_request


def _chosen_helpers(help_request: HelpRequest) -> list[User]:
    """Everyone the author chose (a request may need several people)."""
    return [
        r.helper
        for r in HelpResponse.objects.filter(help_request=help_request, status=ResponseStatus.ACCEPTED).select_related(
            "helper"
        )
    ]


@transaction.atomic
def cancel_help_request(author: User, help_request_id) -> HelpRequest:
    """ACTIVE → CANCELLED. IN_PROGRESS can also be cancelled (helper did not show up)."""
    from apps.conversations.services.conversations import close_conversations

    help_request = _lock_own(author, help_request_id)
    if help_request.status == HelpRequestStatus.CANCELLED:
        return help_request
    if help_request.status not in (HelpRequestStatus.ACTIVE, HelpRequestStatus.IN_PROGRESS):
        raise InvalidState(_("Цей запит вже закрито."), code="REQUEST_CLOSED")
    helpers = _chosen_helpers(help_request)
    help_request.status = HelpRequestStatus.CANCELLED
    help_request.cancelled_at = timezone.now()
    help_request.save(update_fields=["status", "cancelled_at", "updated_at"])
    HelpResponse.objects.filter(help_request=help_request, status=ResponseStatus.PENDING).update(
        status=ResponseStatus.CANCELLED, updated_at=timezone.now()
    )
    close_conversations(help_request)
    for helper in helpers:
        notify(
            helper,
            NotificationType.REQUEST_CANCELLED,
            title=_("Запит скасовано"),
            body=_("Автор скасував запит, з яким ви допомагали"),
            url=f"/help/{help_request.id}",
            help_request=help_request,
        )
    analytics.track(user_id=author.id, event="help_requests_cancelled", properties={"help_request_id": help_request.id})
    return help_request


@transaction.atomic
def complete_help_request(author: User, help_request_id) -> HelpRequest:
    """IN_PROGRESS → COMPLETED (author only). Idempotent."""
    from apps.conversations.models import Conversation
    from apps.conversations.services.conversations import post_system_message

    help_request = _lock_own(author, help_request_id)
    if help_request.status == HelpRequestStatus.COMPLETED:
        return help_request
    if help_request.status != HelpRequestStatus.IN_PROGRESS:
        raise InvalidState(_("Завершити можна тільки запит, з яким вже допомагають."), code="REQUEST_NOT_IN_PROGRESS")
    now = timezone.now()
    help_request.status = HelpRequestStatus.COMPLETED
    help_request.completed_at = now
    help_request.save(update_fields=["status", "completed_at", "updated_at"])
    for helper in _chosen_helpers(help_request):
        Profile.objects.filter(user_id=helper.pk).update(helped_count=F("helped_count") + 1)
        conversation = Conversation.objects.filter(help_request=help_request, helper_id=helper.pk).first()
        if conversation:
            post_system_message(conversation, _("Допомогу отримано ❤️ Запит завершено."))
        notify(
            helper,
            NotificationType.REQUEST_COMPLETED,
            title=_("🎉 Допомога завершена"),
            body=_("Дякуємо, що допомогли людині поруч!"),
            url=f"/help/{help_request.id}",
            help_request=help_request,
        )
    analytics.track(
        user_id=author.id,
        event="help_requests_completed",
        properties={
            "help_request_id": help_request.id,
            "time_to_completion_seconds": int((now - help_request.created_at).total_seconds()),
        },
    )
    return help_request


def expire_help_requests() -> int:
    """Periodic: ACTIVE with expires_at < now → EXPIRED; warn authors shortly before expiry."""
    now = timezone.now()
    expiring_window = now + timedelta(minutes=settings.HELP_REQUEST_EXPIRING_NOTICE_MINUTES)
    expiring = HelpRequest.objects.filter(
        status=HelpRequestStatus.ACTIVE,
        expires_at__gt=now,
        expires_at__lte=expiring_window,
        expiring_notified_at__isnull=True,
    ).select_related("author")
    for help_request in expiring:
        updated = HelpRequest.objects.filter(pk=help_request.pk, expiring_notified_at__isnull=True).update(
            expiring_notified_at=now
        )
        if updated:
            notify(
                help_request.author,
                NotificationType.REQUEST_EXPIRING,
                title=_("⏳ Запит скоро завершиться"),
                body=_("Ваш запит «{title}» скоро стане неактивним").format(title=help_request.title[:60]),
                url=f"/help/{help_request.id}",
                help_request=help_request,
                dedupe_key=f"expiring:{help_request.id}",
            )

    with transaction.atomic():
        expired_ids = list(
            HelpRequest.objects.select_for_update(skip_locked=True)
            .filter(status=HelpRequestStatus.ACTIVE, expires_at__lt=now)
            .values_list("id", flat=True)
        )
        if expired_ids:
            HelpRequest.objects.filter(id__in=expired_ids).update(status=HelpRequestStatus.EXPIRED, updated_at=now)
            HelpResponse.objects.filter(help_request_id__in=expired_ids, status=ResponseStatus.PENDING).update(
                status=ResponseStatus.CANCELLED, updated_at=now
            )
    for request_id in expired_ids:
        analytics.track(user_id=None, event="help_requests_expired", properties={"help_request_id": request_id})
    return len(expired_ids)


def cancel_open_requests_of_user(user: User) -> None:
    for request_id in HelpRequest.objects.filter(
        author=user, status__in=[HelpRequestStatus.ACTIVE, HelpRequestStatus.IN_PROGRESS]
    ).values_list("id", flat=True):
        cancel_help_request(user, request_id)
