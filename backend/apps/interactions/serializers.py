from rest_framework import serializers

from apps.interactions.constants import OfferType
from apps.interactions.models import HelpResponse
from apps.users.serializers import PublicUserSerializer


class RespondSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
    offer_type = serializers.ChoiceField(choices=OfferType.choices, required=False, default=OfferType.ACCEPT)
    offered_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True, min_value=0
    )


class SelectHelperSerializer(serializers.Serializer):
    response_id = serializers.UUIDField()


class HelpResponseSerializer(serializers.ModelSerializer):
    helper = PublicUserSerializer(read_only=True)
    help_request_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = HelpResponse
        fields = ["id", "help_request_id", "helper", "message", "offer_type", "offered_amount", "status", "created_at"]
