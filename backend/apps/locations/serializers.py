from rest_framework import serializers

from apps.help_requests.constants import NOTIFICATION_CATEGORIES
from apps.locations.models import Availability, City


class LocationInputSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    accuracy = serializers.FloatField(required=False, allow_null=True)


class CitySerializer(serializers.ModelSerializer):
    center = serializers.SerializerMethodField()

    class Meta:
        model = City
        fields = ["id", "name", "slug", "country_code", "center", "default_zoom", "is_default"]

    def get_center(self, city: City) -> dict:
        return {"latitude": city.center.y, "longitude": city.center.x}


class AvailabilityInputSerializer(LocationInputSerializer):
    radius = serializers.IntegerField(required=False)
    categories = serializers.ListField(
        child=serializers.ChoiceField(choices=[c.value for c in NOTIFICATION_CATEGORIES]),
        required=False,
        max_length=len(NOTIFICATION_CATEGORIES),
    )
    duration_minutes = serializers.IntegerField(required=False, min_value=15)


class AvailabilitySerializer(serializers.ModelSerializer):
    active = serializers.BooleanField(source="is_currently_active")

    class Meta:
        model = Availability
        fields = ["active", "radius", "categories", "expires_at"]
