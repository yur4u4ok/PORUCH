from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.interactions.models import HelpResponse
from apps.interactions.serializers import HelpResponseSerializer
from apps.interactions.services import responses as svc
from common.exceptions import NotFound


class HelpResponseViewSet(viewsets.ViewSet):
    lookup_value_regex = "[0-9a-fA-F-]{36}"

    def _get_visible(self, request, pk) -> HelpResponse:
        response = HelpResponse.objects.select_related("help_request", "helper__profile__avatar").filter(pk=pk).first()
        if response is None or request.user.pk not in (response.helper_id, response.help_request.author_id):
            raise NotFound()
        return response

    @extend_schema(responses=HelpResponseSerializer)
    def retrieve(self, request, pk=None):
        return Response(HelpResponseSerializer(self._get_visible(request, pk)).data)

    @extend_schema(request=None, responses=HelpResponseSerializer)
    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        response = self._get_visible(request, pk)
        svc.select_helper(request.user, response.help_request_id, response.pk)
        return Response(HelpResponseSerializer(self._get_visible(request, pk)).data)

    @extend_schema(request=None, responses=HelpResponseSerializer)
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        svc.reject_response(request.user, pk)
        return Response(HelpResponseSerializer(self._get_visible(request, pk)).data)

    @extend_schema(request=None, responses=HelpResponseSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        svc.cancel_response(request.user, pk)
        return Response(HelpResponseSerializer(self._get_visible(request, pk)).data)
