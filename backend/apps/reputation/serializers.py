from rest_framework import serializers

from apps.reputation.models import ThankYou
from apps.users.serializers import PublicUserSerializer


class ThankYouCreateSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=500, required=False, allow_blank=True)


class ThankYouSerializer(serializers.ModelSerializer):
    from_user = PublicUserSerializer(read_only=True)
    help_request = serializers.SerializerMethodField()

    class Meta:
        model = ThankYou
        fields = ["id", "from_user", "message", "help_request", "created_at"]

    def get_help_request(self, obj) -> dict:
        return {"id": str(obj.help_request_id), "title": obj.help_request.title, "category": obj.help_request.category}
