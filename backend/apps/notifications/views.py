from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import ListAPIView, get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications import serializers as s
from apps.notifications.models import Notification, PushSubscription
from apps.notifications.services.preferences import get_preferences, update_preferences
from common import analytics
from common.permissions import IsAuthenticatedUser


class NotificationListView(ListAPIView):
    serializer_class = s.NotificationSerializer

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user)
        if self.request.query_params.get("unread") in ("1", "true"):
            qs = qs.filter(read_at__isnull=True)
        return qs

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response.data["unread_count"] = Notification.objects.filter(user=request.user, read_at__isnull=True).count()
        return response


class NotificationReadView(APIView):
    @extend_schema(request=s.NotificationReadSerializer, responses=s.NotificationSerializer)
    def post(self, request, notification_id):
        ser = s.NotificationReadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        notification = get_object_or_404(Notification, id=notification_id, user=request.user)
        now = timezone.now()
        fields = []
        if notification.read_at is None:
            notification.read_at = now
            fields.append("read_at")
        if ser.validated_data["via_push"] and notification.push_opened_at is None:
            notification.push_opened_at = now
            fields.append("push_opened_at")
            analytics.track(user_id=request.user.id, event="push_opened", properties={"type": notification.type})
        if fields:
            notification.save(update_fields=fields)
        return Response(s.NotificationSerializer(notification).data)


class NotificationReadAllView(APIView):
    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        Notification.objects.filter(user=request.user, read_at__isnull=True).update(read_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)


class PushSubscriptionCreateView(APIView):
    @extend_schema(request=s.PushSubscriptionCreateSerializer, responses={201: s.PushSubscriptionSerializer})
    def post(self, request):
        ser = s.PushSubscriptionCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        with transaction.atomic():
            sub, created = PushSubscription.objects.select_for_update().update_or_create(
                endpoint=data["endpoint"],
                defaults={
                    "user": request.user,
                    "p256dh": data["keys"]["p256dh"],
                    "auth": data["keys"]["auth"],
                    "user_agent": request.headers.get("User-Agent", "")[:255],
                    "failure_count": 0,
                },
            )
        return Response(
            s.PushSubscriptionSerializer(sub).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class PushSubscriptionDeleteView(APIView):
    @extend_schema(responses={204: None})
    def delete(self, request, subscription_id):
        PushSubscription.objects.filter(id=subscription_id, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PreferencesView(APIView):
    permission_classes = [IsAuthenticatedUser]

    @extend_schema(responses=s.PreferencesSerializer)
    def get(self, request):
        return Response(s.PreferencesSerializer(get_preferences(request.user)).data)

    @extend_schema(request=s.PreferencesUpdateSerializer, responses=s.PreferencesSerializer)
    def patch(self, request):
        ser = s.PreferencesUpdateSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        prefs = update_preferences(request.user, ser.validated_data)
        return Response(s.PreferencesSerializer(prefs).data)
