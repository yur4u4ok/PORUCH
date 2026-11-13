from rest_framework import serializers

from apps.reputation.models import Review, ThankYou
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


class ReviewCreateSerializer(serializers.Serializer):
    to_user = serializers.UUIDField()
    rating = serializers.IntegerField(min_value=1, max_value=5)
    text = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class ReviewSerializer(serializers.ModelSerializer):
    from_user = PublicUserSerializer(read_only=True)
    help_request = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ["id", "from_user", "rating", "text", "help_request", "created_at"]

    def get_help_request(self, obj) -> dict:
        return {"id": str(obj.help_request_id), "title": obj.help_request.title, "category": obj.help_request.category}
