from rest_framework import serializers

from apps.interactions.models import HelpResponse
from apps.users.serializers import PublicUserSerializer


class RespondSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class SelectHelperSerializer(serializers.Serializer):
    response_id = serializers.UUIDField()


class HelpResponseSerializer(serializers.ModelSerializer):
    helper = PublicUserSerializer(read_only=True)
    help_request_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = HelpResponse
        fields = ["id", "help_request_id", "helper", "message", "status", "created_at"]
