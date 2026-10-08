"""Responses («Можу допомогти») and helper selection."""

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.help_requests.constants import HelpRequestStatus, RewardOption, RewardType
from apps.help_requests.models import HelpRequest
from apps.interactions.constants import ACTIVE_RESPONSE_STATUSES, OfferType, ResponseStatus
from apps.interactions.models import HelpResponse
from apps.moderation.selectors import is_blocked_between
from apps.notifications.models import NotificationType
from apps.notifications.services.notify import notify
from apps.users.models import User
from common import analytics
from common.exceptions import Conflict, Forbidden, InvalidState, NotFound, ValidationFailed
from common.utils.money import format_money


def _display_name(user: User) -> str:
    profile = user.profile
    return profile.display_name if profile.show_name else _("Сусід")


def _normalize_offer(help_request: HelpRequest, offer_type: str | None, offered_amount):
    """Offers only make sense for «Готовий(-а) віддячити»; otherwise the response is a plain ACCEPT."""
    if help_request.reward_type != RewardType.WILLING:
        return OfferType.ACCEPT, None
    offer_type = offer_type or OfferType.ACCEPT
    if offer_type == OfferType.COUNTER:
        if offered_amount is None or offered_amount <= 0:
            raise ValidationFailed(details={"offered_amount": [_("Вкажіть суму, яку пропонуєте.")]})
        return offer_type, offered_amount
    return offer_type, None


def offer_summary(help_request: HelpRequest, offer_type: str | None, amount) -> str:
    """Human text of the agreed terms for the chat (UA; informational, no payments)."""
    if offer_type == OfferType.FREE or help_request.reward_type != RewardType.WILLING:
        return _("Допомога без оплати")
    if offer_type == OfferType.COUNTER and amount:
        return format_money(amount, help_request.reward_currency)
    parts = []
    if help_request.reward_amount:
        parts.append(format_money(help_request.reward_amount, help_request.reward_currency))
    labels = dict(RewardOption.choices)
    parts += [str(labels[o]) for o in help_request.reward_options if o in labels]
    return ", ".join(parts)


@transaction.atomic
def respond(
    helper: User, help_request_id, message: str = "", offer_type: str | None = None, offered_amount=None
) -> tuple[HelpResponse, bool]:
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

    offer_type, offered_amount = _normalize_offer(help_request, offer_type, offered_amount)
    try:
        with transaction.atomic():
            response = HelpResponse.objects.create(
                help_request=help_request,
                helper=helper,
                message=message.strip(),
                offer_type=offer_type,
                offered_amount=offered_amount,
            )
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
        body=_("{name} готовий(-а) допомогти з вашим запитом").format(name=_display_name(helper))
        + (f" · {offer_summary(help_request, offer_type, offered_amount)}" if offer_type != OfferType.ACCEPT else ""),
        url=f"/help/{help_request.id}",
        help_request=help_request,
        data={"help_request_id": str(help_request.id), "response_id": str(response.id)},
    )
    analytics.track(user_id=helper.id, event="help_response_created", properties={"help_request_id": help_request.id})
    return response, True


def accepted_responses(help_request: HelpRequest):
    return HelpResponse.objects.filter(help_request=help_request, status=ResponseStatus.ACCEPTED)


def _agreed_terms(help_request: HelpRequest, response: HelpResponse) -> tuple[str | None, object]:
    """Terms locked in for this helper: author's terms, an agreed counter amount, or free help."""
    if help_request.reward_type != RewardType.WILLING:
        return None, None
    if response.offer_type == OfferType.FREE:
        return OfferType.FREE, None
    if response.offer_type == OfferType.COUNTER:
        return OfferType.COUNTER, response.offered_amount
    return OfferType.ACCEPT, help_request.reward_amount


def _accept_response(help_request: HelpRequest, response: HelpResponse, *, agreed_type, agreed_amount):
    """Mark a helper as chosen; close the request to others once enough helpers are chosen.

    Caller holds row locks on the request and the response.
    """
    from apps.conversations.services.conversations import (
        get_or_create_for_help_request,
        post_offer_message,
        post_system_message,
    )

    now = timezone.now()
    response.status = ResponseStatus.ACCEPTED
    response.agreed_offer_type = agreed_type
    response.agreed_amount = agreed_amount
    response.save(update_fields=["status", "agreed_offer_type", "agreed_amount", "updated_at"])

    fields = ["updated_at"]
    if help_request.selected_helper_id is None:  # the first chosen helper (also the request-level terms)
        help_request.selected_helper = response.helper
        help_request.agreed_offer_type = agreed_type
        help_request.agreed_amount = agreed_amount
        fields += ["selected_helper", "agreed_offer_type", "agreed_amount"]
    rejected: list[HelpResponse] = []
    if accepted_responses(help_request).count() >= help_request.helpers_needed:
        help_request.status = HelpRequestStatus.IN_PROGRESS
        help_request.in_progress_at = now
        fields += ["status", "in_progress_at"]
        rejected = list(
            HelpResponse.objects.filter(help_request=help_request, status=ResponseStatus.PENDING).select_related(
                "helper"
            )
        )
        HelpResponse.objects.filter(pk__in=[r.pk for r in rejected]).update(
            status=ResponseStatus.REJECTED, updated_at=now
        )
    help_request.save(update_fields=fields)

    conversation = get_or_create_for_help_request(help_request, response.helper)
    post_offer_message(conversation, response.helper, response.message, response.created_at)
    post_system_message(conversation, _("Помічника обрано. Домовтеся про деталі в цьому чаті."))
    if help_request.reward_type == RewardType.WILLING:
        post_system_message(
            conversation,
            _("Домовленість про подяку: {terms}").format(terms=offer_summary(help_request, agreed_type, agreed_amount)),
        )
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
            body=_("Автор запиту вже знайшов помічників"),
            url=f"/help/{help_request.id}",
            help_request=help_request,
            push=False,
        )
    analytics.track(
        user_id=help_request.author_id,
        event="help_response_accepted",
        properties={
            "help_request_id": help_request.id,
            "seconds_to_help": int((now - help_request.created_at).total_seconds()),
        },
    )
    return conversation


def _lock_request_and_response(help_request_id, response_id) -> tuple[HelpRequest, HelpResponse]:
    help_request = HelpRequest.objects.select_for_update().filter(id=help_request_id).first()
    if help_request is None:
        raise NotFound()
    response = (
        HelpResponse.objects.select_for_update()
        .select_related("helper")
        .filter(id=response_id, help_request=help_request)
        .first()
    )
    if response is None:
        raise NotFound()
    return help_request, response


@transaction.atomic
def select_helper(author: User, help_request_id, response_id):
    """Choose a helper. Row locks keep the number of chosen helpers within helpers_needed.

    Idempotent: choosing an already chosen helper returns the same state.
    """
    from apps.conversations.services.conversations import get_or_create_for_help_request

    help_request, response = _lock_request_and_response(help_request_id, response_id)
    if help_request.author_id != author.pk:
        raise Forbidden(_("Тільки автор може обрати помічника."), code="NOT_AUTHOR")
    if response.status == ResponseStatus.ACCEPTED:
        return help_request, response, get_or_create_for_help_request(help_request, response.helper)
    if help_request.status != HelpRequestStatus.ACTIVE:
        raise InvalidState(_("Помічників вже обрано або запит закрито."), code="REQUEST_NOT_ACTIVE")
    if response.status != ResponseStatus.PENDING:
        raise InvalidState(_("Ця пропозиція вже неактивна."), code="RESPONSE_NOT_PENDING")
    if not response.helper.is_active or is_blocked_between(author, response.helper):
        raise InvalidState(_("Користувач недоступний."), code="USER_UNAVAILABLE")
    agreed_type, agreed_amount = _agreed_terms(help_request, response)
    conversation = _accept_response(help_request, response, agreed_type=agreed_type, agreed_amount=agreed_amount)
    return help_request, response, conversation


@transaction.atomic
def counter_offer(author: User, response_id, amount) -> HelpResponse:
    """The author answers a helper's different amount with one amount of their own (only once)."""
    response = (
        HelpResponse.objects.select_for_update().select_related("help_request", "helper").filter(id=response_id).first()
    )
    if response is None:
        raise NotFound()
    help_request = response.help_request
    if help_request.author_id != author.pk:
        raise Forbidden(_("Тільки автор може запропонувати суму."), code="NOT_AUTHOR")
    if response.status != ResponseStatus.PENDING or help_request.status != HelpRequestStatus.ACTIVE:
        raise InvalidState(_("Ця пропозиція вже неактивна."), code="RESPONSE_NOT_PENDING")
    if response.offer_type != OfferType.COUNTER:
        raise InvalidState(_("Помічник не пропонував іншу суму."), code="NO_COUNTER_OFFER")
    if response.author_counter_amount is not None:
        raise InvalidState(_("Ви вже запропонували свою суму."), code="COUNTER_ALREADY_SENT")
    if amount is None or amount <= 0:
        raise ValidationFailed(details={"amount": [_("Вкажіть суму, яку пропонуєте.")]})
    response.author_counter_amount = amount
    response.save(update_fields=["author_counter_amount", "updated_at"])
    notify(
        response.helper,
        NotificationType.HELP_RESPONSE_RECEIVED,
        title=_("💬 Автор пропонує іншу суму"),
        body=_("Автор запиту пропонує {amount}. Погодитися чи відмовитися?").format(
            amount=format_money(amount, help_request.reward_currency)
        ),
        url=f"/help/{help_request.id}",
        help_request=help_request,
    )
    return response


@transaction.atomic
def answer_counter_offer(helper: User, response_id, accept: bool):
    """The helper accepts (and is chosen at the author's amount) or declines. No further bargaining."""
    response = HelpResponse.objects.filter(id=response_id).first()
    if response is None or response.helper_id != helper.pk:
        raise NotFound()
    help_request, response = _lock_request_and_response(response.help_request_id, response.pk)
    if response.author_counter_amount is None:
        raise InvalidState(_("Автор не пропонував іншої суми."), code="NO_COUNTER_OFFER")
    if response.status != ResponseStatus.PENDING or help_request.status != HelpRequestStatus.ACTIVE:
        raise InvalidState(_("Ця пропозиція вже неактивна."), code="RESPONSE_NOT_PENDING")
    if not accept:
        response.status = ResponseStatus.CANCELLED
        response.save(update_fields=["status", "updated_at"])
        notify(
            help_request.author,
            NotificationType.HELP_RESPONSE_RECEIVED,
            title=_("Помічник не погодився на суму"),
            body=_("{name} відмовився(-лась) від вашої пропозиції").format(name=_display_name(helper)),
            url=f"/help/{help_request.id}",
            help_request=help_request,
        )
        return response, None
    conversation = _accept_response(
        help_request, response, agreed_type=OfferType.COUNTER, agreed_amount=response.author_counter_amount
    )
    return response, conversation


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
    if was_accepted and help_request.status not in (HelpRequestStatus.ACTIVE, HelpRequestStatus.IN_PROGRESS):
        raise InvalidState(_("Запит вже завершено."), code="REQUEST_NOT_IN_PROGRESS")
    response.status = ResponseStatus.CANCELLED
    response.save(update_fields=["status", "updated_at"])
    if was_accepted:
        fields = ["updated_at"]
        if help_request.status == HelpRequestStatus.IN_PROGRESS:
            # A place is free again: the request is visible to people nearby.
            help_request.status = HelpRequestStatus.ACTIVE
            help_request.in_progress_at = None
            fields += ["status", "in_progress_at"]
        if help_request.selected_helper_id == helper.pk:
            remaining = accepted_responses(help_request).order_by("updated_at").first()
            help_request.selected_helper_id = remaining.helper_id if remaining else None
            help_request.agreed_offer_type = remaining.agreed_offer_type if remaining else None
            help_request.agreed_amount = remaining.agreed_amount if remaining else None
            fields += ["selected_helper", "agreed_offer_type", "agreed_amount"]
        help_request.save(update_fields=fields)
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
