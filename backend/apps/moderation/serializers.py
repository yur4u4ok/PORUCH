from rest_framework import serializers

from apps.moderation.models import Report, UserBlock
from apps.users.serializers import PublicUserSerializer


class ReportCreateSerializer(serializers.Serializer):
    reason = serializers.ChoiceField(choices=Report.Reason.choices)
    description = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    target_user_id = serializers.UUIDField(required=False, allow_null=True)
    help_request_id = serializers.UUIDField(required=False, allow_null=True)
    message_id = serializers.UUIDField(required=False, allow_null=True)


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ["id", "reason", "status", "created_at"]


class BlockCreateSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()


class BlockSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(source="blocked")

    class Meta:
        model = UserBlock
        fields = ["user", "created_at"]
