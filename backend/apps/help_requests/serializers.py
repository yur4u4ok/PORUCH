from django.conf import settings
from rest_framework import serializers

from apps.help_requests.constants import Category, HelpRequestStatus, RewardType, Urgency
from apps.help_requests.models import HelpRequest
from apps.help_requests.selectors import can_see_exact_location
from apps.interactions.constants import ACTIVE_RESPONSE_STATUSES
from apps.locations.serializers import LocationInputSerializer
from apps.media.serializers import MediaSerializer
from apps.users.serializers import PublicUserSerializer
from common.utils.geo import approximate_point, point_to_dict, round_distance


class HelpRequestCreateSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=Category.choices)
    subcategory = serializers.CharField(max_length=40, required=False, allow_null=True, allow_blank=True)
    title = serializers.CharField(max_length=120, required=False, allow_blank=True)
    description = serializers.CharField(max_length=1000)
    location = LocationInputSerializer()
    urgency = serializers.ChoiceField(choices=Urgency.choices)
    reward_type = serializers.ChoiceField(choices=RewardType.choices, default=RewardType.NONE)
    reward_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True, min_value=0
    )
    photo_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, max_length=settings.HELP_REQUEST_MAX_PHOTOS
    )
    emergency_acknowledged = serializers.BooleanField(required=False, default=False)


class HelpRequestUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=120, required=False)
    description = serializers.CharField(max_length=1000, required=False)
    reward_type = serializers.ChoiceField(choices=RewardType.choices, required=False)
    reward_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True, min_value=0
    )
    photo_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, max_length=settings.HELP_REQUEST_MAX_PHOTOS
    )


class HelpRequestListQuerySerializer(serializers.Serializer):
    lat = serializers.FloatField(required=False)
    lng = serializers.FloatField(required=False)
    radius = serializers.IntegerField(required=False)
    category = serializers.CharField(required=False)
    urgency = serializers.CharField(required=False)
    status = serializers.CharField(required=False)
    role = serializers.ChoiceField(choices=["author", "helper", "responded"], required=False)

    def _csv(self, value: str | None, allowed: set[str], field: str) -> list[str]:
        if not value:
            return []
        items = [v.strip().upper() for v in value.split(",") if v.strip()]
        if set(items) - allowed:
            raise serializers.ValidationError({field: [f"Allowed: {sorted(allowed)}"]})
        return items

    def validate(self, attrs):
        attrs["categories"] = self._csv(attrs.get("category"), set(Category.values), "category")
        attrs["urgencies"] = self._csv(attrs.get("urgency"), set(Urgency.values), "urgency")
        attrs["statuses"] = self._csv(attrs.get("status"), set(HelpRequestStatus.values), "status")
        if not attrs.get("role") and (attrs.get("lat") is None or attrs.get("lng") is None):
            raise serializers.ValidationError({"lat": ["lat and lng are required for nearby search."]})
        return attrs


class ResponseBriefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    status = serializers.CharField()
    created_at = serializers.DateTimeField()


class HelpRequestSerializer(serializers.ModelSerializer):
    author = PublicUserSerializer(read_only=True)
    photos = MediaSerializer(many=True, read_only=True)
    distance_m = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    is_author = serializers.SerializerMethodField()
    my_response = serializers.SerializerMethodField()
    responses_count = serializers.IntegerField(source="pending_responses_count", read_only=True, default=0)
    selected_helper = serializers.SerializerMethodField()
    conversation_id = serializers.SerializerMethodField()
    can_respond = serializers.SerializerMethodField()
    thanked = serializers.SerializerMethodField()

    class Meta:
        model = HelpRequest
        fields = [
            "id",
            "category",
            "subcategory",
            "title",
            "description",
            "urgency",
            "reward_type",
            "reward_amount",
            "status",
            "created_at",
            "updated_at",
            "expires_at",
            "completed_at",
            "author",
            "photos",
            "distance_m",
            "location",
            "is_author",
            "my_response",
            "responses_count",
            "selected_helper",
            "conversation_id",
            "can_respond",
            "thanked",
        ]

    @property
    def _viewer(self):
        return self.context["request"].user

    def get_distance_m(self, obj) -> int | None:
        distance = getattr(obj, "distance", None)
        return round_distance(distance.m) if distance is not None else None

    def get_location(self, obj) -> dict:
        if can_see_exact_location(self._viewer, obj):
            return {**point_to_dict(obj.location), "approximate": False}
        return {**approximate_point(obj.location), "approximate": True}

    def get_is_author(self, obj) -> bool:
        return obj.author_id == self._viewer.pk

    def _viewer_responses(self, obj):
        responses = getattr(obj, "viewer_responses", None)
        if responses is None:
            responses = list(obj.responses.filter(helper=self._viewer).order_by("-created_at"))
        return responses

    def get_my_response(self, obj) -> dict | None:
        responses = self._viewer_responses(obj)
        active = [r for r in responses if r.status in ACTIVE_RESPONSE_STATUSES]
        chosen = active[0] if active else (responses[0] if responses else None)
        return ResponseBriefSerializer(chosen).data if chosen else None

    def get_selected_helper(self, obj) -> dict | None:
        if obj.selected_helper_id and self._viewer.pk in (obj.author_id, obj.selected_helper_id):
            return PublicUserSerializer(obj.selected_helper).data
        return None

    def get_conversation_id(self, obj) -> str | None:
        if self._viewer.pk not in (obj.author_id, obj.selected_helper_id) or not obj.selected_helper_id:
            return None
        for conversation in obj.conversations.all():
            if conversation.helper_id == obj.selected_helper_id:
                return str(conversation.id)
        return None

    def get_can_respond(self, obj) -> bool:
        if obj.author_id == self._viewer.pk or obj.status != HelpRequestStatus.ACTIVE:
            return False
        return not any(
            r.status in ACTIVE_RESPONSE_STATUSES or r.status == "REJECTED" for r in self._viewer_responses(obj)
        )

    def get_thanked(self, obj) -> bool | None:
        if obj.author_id != self._viewer.pk or obj.status != HelpRequestStatus.COMPLETED:
            return None
        return obj.thanks.exists()
