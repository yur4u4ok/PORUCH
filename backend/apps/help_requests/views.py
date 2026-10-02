from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.help_requests import selectors
from apps.help_requests.serializers import (
    HelpRequestCreateSerializer,
    HelpRequestListQuerySerializer,
    HelpRequestSerializer,
    HelpRequestUpdateSerializer,
)
from apps.help_requests.services import lifecycle
from apps.help_requests.services.create_request import create_help_request
from apps.interactions.models import HelpResponse
from apps.interactions.serializers import HelpResponseSerializer, RespondSerializer, SelectHelperSerializer
from apps.interactions.services import responses as response_svc
from apps.reputation.serializers import ThankYouCreateSerializer, ThankYouSerializer
from apps.reputation.services.thanks import create_thank_you
from common.exceptions import Forbidden, NotFound
from common.throttling import CreateHelpRequestThrottle, RespondThrottle
from common.utils.geo import normalize_radius, validate_coordinates


def _viewer_point(request):
    lat, lng = request.query_params.get("lat"), request.query_params.get("lng")
    if lat in (None, "") or lng in (None, ""):
        return None
    return validate_coordinates(lat, lng).to_point()


UUID_REGEX = "[0-9a-fA-F-]{36}"


class HelpRequestViewSet(viewsets.ViewSet):
    lookup_value_regex = UUID_REGEX

    def get_throttles(self):
        if self.action == "create":
            return [CreateHelpRequestThrottle()]
        if self.action == "respond":
            return [RespondThrottle()]
        return super().get_throttles()

    def _serialize(self, request, instance, **kwargs):
        return HelpRequestSerializer(instance, context={"request": request}, **kwargs).data

    def _reload(self, request, pk):
        qs = selectors.with_distance(selectors.base_queryset(request.user), _viewer_point(request))
        return qs.get(pk=pk)

    @extend_schema(
        parameters=[
            OpenApiParameter("lat", float),
            OpenApiParameter("lng", float),
            OpenApiParameter("radius", int),
            OpenApiParameter("category", str),
            OpenApiParameter("urgency", str),
            OpenApiParameter("status", str),
            OpenApiParameter("role", str, enum=["author", "helper", "responded"]),
        ],
        responses=HelpRequestSerializer(many=True),
    )
    def list(self, request):
        query = HelpRequestListQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        params = query.validated_data
        if params.get("role"):
            qs = selectors.requests_by_role(request.user, params["role"], params["statuses"])
            qs = selectors.with_distance(qs, _viewer_point(request))
        else:
            point = validate_coordinates(params["lat"], params["lng"]).to_point()
            qs = selectors.nearby_requests(
                request.user,
                point,
                normalize_radius(params.get("radius")),
                categories=params["categories"],
                urgencies=params["urgencies"],
            )
        from common.pagination import DefaultPagination

        paginator = DefaultPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response(self._serialize(request, page, many=True))

    @extend_schema(request=HelpRequestCreateSerializer, responses={201: HelpRequestSerializer})
    def create(self, request):
        ser = HelpRequestCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        help_request = create_help_request(request.user, **ser.validated_data)
        return Response(
            self._serialize(request, self._reload(request, help_request.pk)), status=status.HTTP_201_CREATED
        )

    @extend_schema(
        parameters=[OpenApiParameter("lat", float), OpenApiParameter("lng", float)],
        responses=HelpRequestSerializer,
    )
    def retrieve(self, request, pk=None):
        help_request = selectors.visible_request(request.user, pk)
        if help_request is None:
            raise NotFound()
        return Response(self._serialize(request, self._reload(request, pk)))

    @extend_schema(request=HelpRequestUpdateSerializer, responses=HelpRequestSerializer)
    def partial_update(self, request, pk=None):
        ser = HelpRequestUpdateSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        lifecycle.update_help_request(request.user, pk, ser.validated_data)
        return Response(self._serialize(request, self._reload(request, pk)))

    @extend_schema(responses={204: None})
    def destroy(self, request, pk=None):
        """Soft delete = cancel. Historical data is kept."""
        lifecycle.cancel_help_request(request.user, pk)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=None, responses=HelpRequestSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        lifecycle.cancel_help_request(request.user, pk)
        return Response(self._serialize(request, self._reload(request, pk)))

    @extend_schema(request=None, responses=HelpRequestSerializer)
    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        lifecycle.complete_help_request(request.user, pk)
        return Response(self._serialize(request, self._reload(request, pk)))

    @extend_schema(request=RespondSerializer, responses={201: HelpResponseSerializer})
    @action(detail=True, methods=["post"])
    def respond(self, request, pk=None):
        ser = RespondSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        response, created = response_svc.respond(request.user, pk, **ser.validated_data)
        return Response(
            HelpResponseSerializer(response).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    @extend_schema(request=SelectHelperSerializer, responses=HelpRequestSerializer)
    @action(detail=True, methods=["post"], url_path="select-helper")
    def select_helper(self, request, pk=None):
        ser = SelectHelperSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        response_svc.select_helper(request.user, pk, ser.validated_data["response_id"])
        return Response(self._serialize(request, self._reload(request, pk)))

    @extend_schema(responses=HelpResponseSerializer(many=True))
    @action(detail=True, methods=["get"])
    def responses(self, request, pk=None):
        help_request = selectors.visible_request(request.user, pk)
        if help_request is None:
            raise NotFound()
        if help_request.author_id != request.user.pk:
            raise Forbidden(code="NOT_AUTHOR")
        qs = (
            HelpResponse.objects.filter(help_request=help_request)
            .exclude(status="CANCELLED")
            .select_related("helper__profile__avatar")
            .order_by("created_at")
        )
        return Response(HelpResponseSerializer(qs, many=True).data)

    @extend_schema(request=ThankYouCreateSerializer, responses={201: ThankYouSerializer})
    @action(detail=True, methods=["post"], url_path="thank-you")
    def thank_you(self, request, pk=None):
        ser = ThankYouCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        thank_you, created = create_thank_you(request.user, pk, ser.validated_data.get("message", ""))
        return Response(
            ThankYouSerializer(thank_you).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )
