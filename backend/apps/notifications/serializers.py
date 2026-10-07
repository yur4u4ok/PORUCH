from rest_framework import serializers

from apps.help_requests.constants import NOTIFICATION_CATEGORIES
from apps.locations.serializers import LocationInputSerializer
from apps.notifications.models import Notification, NotificationPreference, PushSubscription


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "type", "title", "body", "url", "data", "created_at", "read_at", "is_read"]

    def get_is_read(self, obj) -> bool:
        return obj.read_at is not None


class NotificationReadSerializer(serializers.Serializer):
    via_push = serializers.BooleanField(required=False, default=False)


class PushSubscriptionKeysSerializer(serializers.Serializer):
    p256dh = serializers.CharField(max_length=255)
    auth = serializers.CharField(max_length=255)


class PushSubscriptionCreateSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=2000)
    keys = PushSubscriptionKeysSerializer()


class PushSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushSubscription
        fields = ["id", "created_at", "last_used_at"]


class PreferencesSerializer(serializers.ModelSerializer):
    has_location = serializers.SerializerMethodField()

    class Meta:
        model = NotificationPreference
        fields = [
            "notification_radius",
            "enabled_categories",
            "push_enabled",
            "email_enabled",
            "has_location",
            "location_updated_at",
            "muted_until",
        ]

    def get_has_location(self, obj) -> bool:
        return obj.location is not None


class PreferencesUpdateSerializer(serializers.Serializer):
    notification_radius = serializers.IntegerField(required=False)
    enabled_categories = serializers.ListField(
        child=serializers.ChoiceField(choices=[c.value for c in NOTIFICATION_CATEGORIES]), required=False
    )
    push_enabled = serializers.BooleanField(required=False)
    email_enabled = serializers.BooleanField(required=False)
    muted_until = serializers.DateTimeField(required=False, allow_null=True)
    location = LocationInputSerializer(required=False)
