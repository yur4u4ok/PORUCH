"""Public share links for help requests: /r/<code>.

Only what the author already shows to everyone nearby is exposed: no author name,
no exact location, no photos. Closed requests only say that they are inactive.
"""

from django.conf import settings
from django.http import Http404
from django.shortcuts import render
from django.utils.translation import gettext as _
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.help_requests.constants import HelpRequestStatus, RewardOption, RewardType
from apps.help_requests.models import HelpRequest
from common import analytics
from common.throttling import SharePreviewThrottle
from common.utils.money import format_money


def share_url(help_request: HelpRequest) -> str:
    return f"{settings.SHARE_BASE_URL.rstrip('/')}/r/{help_request.share_code}"


def reward_text(help_request: HelpRequest) -> str:
    if help_request.reward_type != RewardType.WILLING:
        return str(RewardType(help_request.reward_type).label)
    labels = dict(RewardOption.choices)
    parts = (
        [format_money(help_request.reward_amount, help_request.reward_currency)] if help_request.reward_amount else []
    )
    parts += [str(labels[o]) for o in help_request.reward_options if o in labels]
    return ", ".join(parts)


def _get(code: str) -> HelpRequest:
    help_request = HelpRequest.objects.select_related("author__profile__city").filter(share_code=code).first()
    if help_request is None or not help_request.author.is_active:
        raise Http404
    return help_request


class SharePreviewSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    active = serializers.BooleanField()
    status = serializers.CharField()
    category = serializers.CharField(allow_null=True)
    subcategory = serializers.CharField(allow_null=True)
    title = serializers.CharField(allow_null=True)
    description = serializers.CharField(allow_null=True)
    urgency = serializers.CharField(allow_null=True)
    needed_at = serializers.DateTimeField(allow_null=True)
    reward_type = serializers.CharField(allow_null=True)
    reward_amount = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    reward_currency = serializers.CharField()
    reward_options = serializers.ListField(child=serializers.CharField())
    place = serializers.CharField(allow_blank=True)
    created_at = serializers.DateTimeField()
    expires_at = serializers.DateTimeField()


def preview_data(help_request: HelpRequest) -> dict:
    active = help_request.status == HelpRequestStatus.ACTIVE and not help_request.is_closed
    profile = getattr(help_request.author, "profile", None)
    city = profile.city if profile else None
    base = {
        "id": help_request.id,
        "active": active,
        "status": help_request.status,
        "created_at": help_request.created_at,
        "expires_at": help_request.expires_at,
        "place": help_request.place_name or (city.name if city else ""),
        "reward_currency": help_request.reward_currency,
    }
    if not active:
        # Do not keep exposing details of finished requests.
        return {
            **base,
            "category": None,
            "subcategory": None,
            "title": None,
            "description": None,
            "urgency": None,
            "needed_at": None,
            "reward_type": None,
            "reward_amount": None,
            "reward_options": [],
        }
    return {
        **base,
        "category": help_request.category,
        "subcategory": help_request.subcategory,
        "title": help_request.title,
        "description": help_request.description,
        "urgency": help_request.urgency,
        "needed_at": help_request.needed_at,
        "reward_type": help_request.reward_type,
        "reward_amount": help_request.reward_amount,
        "reward_options": help_request.reward_options,
    }


class SharePreviewView(APIView):
    """Public, read-only preview used by the /share/<code> page (no login)."""

    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [SharePreviewThrottle]

    @extend_schema(responses=SharePreviewSerializer)
    def get(self, request, code):
        help_request = _get(code)
        analytics.track(user_id=None, event="share_link_opened", properties={"help_request_id": help_request.id})
        return Response(SharePreviewSerializer(preview_data(help_request)).data)


def share_redirect(request, code):
    """/r/<code>: HTML with Open Graph tags for messenger previews, then redirects to the app."""
    help_request = _get(code)
    data = preview_data(help_request)
    city = data["place"]
    if data["active"]:
        title = _("Потрібна допомога: {title}").format(title=help_request.title)
        description = " · ".join(filter(None, [city, reward_text(help_request), help_request.description[:140]]))
    else:
        title = _("Запит уже неактивний")
        description = _("Poruch — локальна мережа взаємодопомоги")
    app_url = f"{settings.FRONTEND_URL.rstrip('/')}/share/{code}"
    return render(
        request,
        "share/redirect.html",
        {
            "title": title,
            "description": description,
            "app_url": app_url,
            "share_url": share_url(help_request),
            "image_url": f"{settings.FRONTEND_URL.rstrip('/')}/og-image.png",
        },
    )
