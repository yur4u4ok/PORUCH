from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.moderation.models import UserBlock
from apps.moderation.serializers import (
    BlockCreateSerializer,
    BlockSerializer,
    ReportCreateSerializer,
    ReportSerializer,
)
from apps.moderation.services import moderation as svc
from common.throttling import ReportsThrottle


class ReportCreateView(APIView):
    throttle_classes = [ReportsThrottle]

    @extend_schema(request=ReportCreateSerializer, responses={201: ReportSerializer})
    def post(self, request):
        ser = ReportCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        report = svc.create_report(request.user, **ser.validated_data)
        return Response(ReportSerializer(report).data, status=status.HTTP_201_CREATED)


class BlockListCreateView(ListAPIView):
    serializer_class = BlockSerializer

    def get_queryset(self):
        return UserBlock.objects.filter(blocker=self.request.user).select_related("blocked__profile__avatar")

    @extend_schema(request=BlockCreateSerializer, responses={201: BlockSerializer})
    def post(self, request):
        ser = BlockCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        block = svc.block_user(request.user, ser.validated_data["user_id"])
        return Response(BlockSerializer(block).data, status=status.HTTP_201_CREATED)


class BlockDeleteView(APIView):
    @extend_schema(responses={204: None})
    def delete(self, request, user_id):
        svc.unblock_user(request.user, user_id)
        return Response(status=status.HTTP_204_NO_CONTENT)
