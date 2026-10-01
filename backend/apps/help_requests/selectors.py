"""Read-side queries for help requests. Geo filtering/sorting is done by PostGIS."""

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.db.models import (
    Case,
    Count,
    F,
    FloatField,
    IntegerField,
    Prefetch,
    Q,
    QuerySet,
    Value,
    When,
)
from django.db.models.functions import Cast, Round
from django.utils import timezone

from apps.help_requests.constants import URGENCY_RANK, HelpRequestStatus
from apps.help_requests.models import HelpRequest
from apps.interactions.constants import ACTIVE_RESPONSE_STATUSES, ResponseStatus
from apps.interactions.models import HelpResponse
from apps.moderation.selectors import blocked_user_ids
from apps.users.models import User


def _urgency_rank():
    return Case(
        *[When(urgency=code, then=Value(rank)) for code, rank in URGENCY_RANK.items()],
        default=Value(9),
        output_field=IntegerField(),
    )


def base_queryset(viewer: User) -> QuerySet[HelpRequest]:
    return (
        HelpRequest.objects.select_related("author__profile__avatar", "selected_helper__profile__avatar")
        .prefetch_related(
            "photos",
            "conversations",
            Prefetch(
                "responses",
                queryset=HelpResponse.objects.filter(helper=viewer).order_by("-created_at"),
                to_attr="viewer_responses",
            ),
        )
        .annotate(
            pending_responses_count=Count(
                "responses", filter=Q(responses__status=ResponseStatus.PENDING), distinct=True
            )
        )
    )


def with_distance(qs: QuerySet[HelpRequest], point: Point | None) -> QuerySet[HelpRequest]:
    if point is None:
        return qs
    return qs.annotate(distance=Distance("location", point))


def nearby_requests(
    viewer: User,
    point: Point,
    radius_m: int,
    *,
    categories: list[str] | None = None,
    urgencies: list[str] | None = None,
) -> QuerySet[HelpRequest]:
    """Active requests around a point: ST_DWithin + ST_Distance, ordered in SQL."""
    blocked = blocked_user_ids(viewer)
    qs = (
        base_queryset(viewer)
        .filter(
            status=HelpRequestStatus.ACTIVE,
            expires_at__gt=timezone.now(),
            author__is_active=True,
            location__dwithin=(point, D(m=radius_m)),
        )
        .exclude(author=viewer)
        .exclude(author_id__in=blocked)
    )
    if categories:
        qs = qs.filter(category__in=categories)
    if urgencies:
        qs = qs.filter(urgency__in=urgencies)
    qs = with_distance(qs, point).annotate(
        # Sort by distance rounded to 100 m (what users see), then urgency, then recency.
        distance_bucket=Cast(Round(Cast(F("distance"), FloatField()) / 100.0), IntegerField()),
        urgency_rank=_urgency_rank(),
    )
    return qs.order_by("distance_bucket", "urgency_rank", "-created_at")


def requests_by_role(viewer: User, role: str, statuses: list[str] | None = None) -> QuerySet[HelpRequest]:
    qs = base_queryset(viewer)
    if role == "author":
        qs = qs.filter(author=viewer)
    elif role == "helper":
        qs = qs.filter(selected_helper=viewer)
    elif role == "responded":
        qs = qs.filter(responses__helper=viewer, responses__status__in=ACTIVE_RESPONSE_STATUSES).distinct()
    else:
        return qs.none()
    if statuses:
        qs = qs.filter(status__in=statuses)
    return qs.order_by("-created_at")


def visible_request(viewer: User, request_id) -> HelpRequest | None:
    qs = base_queryset(viewer).exclude(author_id__in=blocked_user_ids(viewer) - {viewer.pk})
    return qs.filter(id=request_id).first()


def can_see_exact_location(viewer: User, help_request: HelpRequest) -> bool:
    if viewer.pk in (help_request.author_id, help_request.selected_helper_id):
        return True
    responses = getattr(help_request, "viewer_responses", None)
    if responses is None:
        responses = list(help_request.responses.filter(helper=viewer))
    return any(r.status in ACTIVE_RESPONSE_STATUSES for r in responses)
