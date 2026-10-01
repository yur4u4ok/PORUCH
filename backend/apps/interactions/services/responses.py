"""Responses («Можу допомогти») and helper selection."""

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.help_requests.constants import HelpRequestStatus
from apps.help_requests.models import HelpRequest
from apps.interactions.constants import ACTIVE_RESPONSE_STATUSES, ResponseStatus
from apps.interactions.models import HelpResponse
from apps.moderation.selectors import is_blocked_between
from apps.notifications.models import NotificationType
from apps.notifications.services.notify import notify
from apps.users.models import User
from common import analytics
from common.exceptions import Conflict, Forbidden, InvalidState, NotFound


def _display_name(user: User) -> str:
    profile = user.profile
    return profile.display_name if profile.show_name else _("Сусід")


@transaction.atomic
def respond(helper: User, help_request_id, message: str = "") -> tuple[HelpResponse, bool]:
    """Create a PENDING response. Idempotent: returns the existing active response."""
    help_request = HelpRequest.objects.select_for_update().select_related("author").filter(id=help_request_id).first()
    if help_request is None:
        raise NotFound()
    if help_request.author_id == helper.pk:
        raise Forbidden(_("Не можна відгукнутися на власний запит."), code="OWN_REQUEST")
    if is_blocked_between(helper, help_request.author):
        raise NotFound()

    existing = HelpResponse.objects.filter(
        help_request=help_request, helper=helper, status__in=ACTIVE_RESPONSE_STATUSES
    ).first()
    if existing:
        return existing, False

    if help_request.status != HelpRequestStatus.ACTIVE or help_request.expires_at <= timezone.now():
        raise InvalidState(_("Запит вже неактивний."), code="REQUEST_NOT_ACTIVE")
    if HelpResponse.objects.filter(help_request=help_request, helper=helper, status=ResponseStatus.REJECTED).exists():
        raise Conflict(_("Автор вже відхилив вашу пропозицію."), code="RESPONSE_REJECTED")

    try:
        with transaction.atomic():
            response = HelpResponse.objects.create(help_request=help_request, helper=helper, message=message.strip())
    except IntegrityError:
        return (
            HelpResponse.objects.get(help_request=help_request, helper=helper, status__in=ACTIVE_RESPONSE_STATUSES),
            False,
        )

    now = timezone.now()
    if help_request.first_response_at is None:
        help_request.first_response_at = now
        help_request.save(update_fields=["first_response_at", "updated_at"])
        analytics.track(
            user_id=help_request.author_id,
            event="time_to_first_response",
            properties={
                "help_request_id": help_request.id,
                "seconds": int((now - help_request.created_at).total_seconds()),
            },
        )
    notify(
        help_request.author,
        NotificationType.HELP_RESPONSE_RECEIVED,
        title=_("🤝 Хтось може допомогти"),
        body=_("{name} готовий(а) допомогти з вашим запитом").format(name=_display_name(helper)),
        url=f"/help/{help_request.id}",
        help_request=help_request,
        data={"help_request_id": str(help_request.id), "response_id": str(response.id)},
    )
    analytics.track(user_id=helper.id, event="help_response_created", properties={"help_request_id": help_request.id})
    return response, True


@transaction.atomic
def select_helper(author: User, help_request_id, response_id):
    """Accept a response. Row locks guarantee only one helper is ever selected.

    Idempotent: repeating the call for the already-selected response returns the same state.
    """
    from apps.conversations.services.conversations import get_or_create_for_help_request, post_system_message

    help_request = HelpRequest.objects.select_for_update().filter(id=help_request_id).first()
    if help_request is None:
        raise NotFound()
    if help_request.author_id != author.pk:
        raise Forbidden(_("Тільки автор може обрати помічника."), code="NOT_AUTHOR")
    response = (
        HelpResponse.objects.select_for_update()
        .select_related("helper")
        .filter(id=response_id, help_request=help_request)
        .first()
    )
    if response is None:
        raise NotFound()

    if help_request.status == HelpRequestStatus.IN_PROGRESS and help_request.selected_helper_id == response.helper_id:
        conversation = get_or_create_for_help_request(help_request, response.helper)
        return help_request, response, conversation
    if help_request.status != HelpRequestStatus.ACTIVE:
        raise InvalidState(_("Помічника вже обрано або запит закрито."), code="REQUEST_NOT_ACTIVE")
    if response.status != ResponseStatus.PENDING:
        raise InvalidState(_("Ця пропозиція вже неактивна."), code="RESPONSE_NOT_PENDING")
    if not response.helper.is_active or is_blocked_between(author, response.helper):
        raise InvalidState(_("Користувач недоступний."), code="USER_UNAVAILABLE")

    now = timezone.now()
    help_request.status = HelpRequestStatus.IN_PROGRESS
    help_request.selected_helper = response.helper
    help_request.in_progress_at = now
    help_request.save(update_fields=["status", "selected_helper", "in_progress_at", "updated_at"])

    response.status = ResponseStatus.ACCEPTED
    response.save(update_fields=["status", "updated_at"])

    rejected = list(
        HelpResponse.objects.filter(help_request=help_request, status=ResponseStatus.PENDING)
        .exclude(pk=response.pk)
        .select_related("helper")
    )
    HelpResponse.objects.filter(pk__in=[r.pk for r in rejected]).update(status=ResponseStatus.REJECTED, updated_at=now)

    conversation = get_or_create_for_help_request(help_request, response.helper)
    post_system_message(conversation, _("Помічника обрано. Домовтеся про деталі в цьому чаті."))

    notify(
        response.helper,
        NotificationType.HELP_RESPONSE_ACCEPTED,
        title=_("✅ Вашу допомогу прийнято"),
        body=_("Напишіть людині, щоб домовитися про деталі"),
        url=f"/chats/{conversation.id}",
        help_request=help_request,
        data={"help_request_id": str(help_request.id), "conversation_id": str(conversation.id)},
    )
    for other in rejected:
        notify(
            other.helper,
            NotificationType.HELP_RESPONSE_REJECTED,
            title=_("Дякуємо за готовність допомогти"),
            body=_("Автор запиту вже знайшов помічника"),
            url=f"/help/{help_request.id}",
            help_request=help_request,
            push=False,
        )
    analytics.track(
        user_id=author.id,
        event="help_response_accepted",
        properties={
            "help_request_id": help_request.id,
            "seconds_to_help": int((now - help_request.created_at).total_seconds()),
        },
    )
    return help_request, response, conversation


@transaction.atomic
def reject_response(author: User, response_id) -> HelpResponse:
    response = (
        HelpResponse.objects.select_for_update().select_related("help_request", "helper").filter(id=response_id).first()
    )
    if response is None:
        raise NotFound()
    if response.help_request.author_id != author.pk:
        raise Forbidden(_("Тільки автор може відхилити пропозицію."), code="NOT_AUTHOR")
    if response.status == ResponseStatus.REJECTED:
        return response
    if response.status != ResponseStatus.PENDING:
        raise InvalidState(_("Ця пропозиція вже неактивна."), code="RESPONSE_NOT_PENDING")
    response.status = ResponseStatus.REJECTED
    response.save(update_fields=["status", "updated_at"])
    notify(
        response.helper,
        NotificationType.HELP_RESPONSE_REJECTED,
        title=_("Дякуємо за готовність допомогти"),
        body=_("Цього разу автор обрав інший варіант"),
        url=f"/help/{response.help_request_id}",
        help_request=response.help_request,
        push=False,
    )
    return response


@transaction.atomic
def cancel_response(helper: User, response_id) -> HelpResponse:
    """Helper withdraws. If already accepted, the request goes back to ACTIVE."""
    from apps.conversations.services.conversations import close_conversations

    response = HelpResponse.objects.select_for_update().filter(id=response_id).first()
    if response is None or response.helper_id != helper.pk:
        raise NotFound()
    if response.status == ResponseStatus.CANCELLED:
        return response
    if response.status not in ACTIVE_RESPONSE_STATUSES:
        raise InvalidState(_("Ця пропозиція вже неактивна."), code="RESPONSE_NOT_PENDING")
    help_request = HelpRequest.objects.select_for_update().get(pk=response.help_request_id)
    was_accepted = response.status == ResponseStatus.ACCEPTED
    if was_accepted and help_request.status != HelpRequestStatus.IN_PROGRESS:
        raise InvalidState(_("Запит вже завершено."), code="REQUEST_NOT_IN_PROGRESS")
    response.status = ResponseStatus.CANCELLED
    response.save(update_fields=["status", "updated_at"])
    if was_accepted:
        help_request.status = HelpRequestStatus.ACTIVE
        help_request.selected_helper = None
        help_request.in_progress_at = None
        help_request.save(update_fields=["status", "selected_helper", "in_progress_at", "updated_at"])
        close_conversations(help_request, helper)
        notify(
            help_request.author,
            NotificationType.HELP_RESPONSE_RECEIVED,
            title=_("Помічник не зможе допомогти"),
            body=_("Ваш запит знову активний — інші люди поруч можуть відгукнутися"),
            url=f"/help/{help_request.id}",
            help_request=help_request,
        )
    return response


def cancel_pending_responses_of_user(user: User) -> int:
    return HelpResponse.objects.filter(helper=user, status=ResponseStatus.PENDING).update(
        status=ResponseStatus.CANCELLED, updated_at=timezone.now()
    )


def cancel_pending_between(a: User, b: User) -> int:
    return HelpResponse.objects.filter(
        Q(helper=a, help_request__author=b) | Q(helper=b, help_request__author=a),
        status=ResponseStatus.PENDING,
    ).update(status=ResponseStatus.CANCELLED, updated_at=timezone.now())
