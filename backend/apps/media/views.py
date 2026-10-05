from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.media.serializers import (
    ConfirmSerializer,
    MediaSerializer,
    UploadUrlRequestSerializer,
    UploadUrlResponseSerializer,
)
from apps.media.services import media as svc
from common.throttling import MediaUploadThrottle


class UploadUrlView(APIView):
    throttle_classes = [MediaUploadThrottle]

    @extend_schema(request=UploadUrlRequestSerializer, responses={201: UploadUrlResponseSerializer})
    def post(self, request):
        ser = UploadUrlRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        media, upload = svc.create_upload(request.user, **ser.validated_data)
        return Response({"media_id": media.id, "upload": upload}, status=status.HTTP_201_CREATED)


class ConfirmView(APIView):
    @extend_schema(request=ConfirmSerializer, responses=MediaSerializer)
    def post(self, request):
        ser = ConfirmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        media = svc.confirm_upload(request.user, ser.validated_data["media_id"])
        return Response(MediaSerializer(media).data)


class MediaDetailView(APIView):
    @extend_schema(responses={204: None})
    def delete(self, request, media_id):
        svc.delete_media(request.user, media_id)
        return Response(status=status.HTTP_204_NO_CONTENT)
