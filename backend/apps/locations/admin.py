from django.contrib.gis import admin

from apps.locations.models import Availability, City


@admin.register(City)
class CityAdmin(admin.GISModelAdmin):
    list_display = ["name", "slug", "country_code", "is_active", "is_default"]


@admin.register(Availability)
class AvailabilityAdmin(admin.ModelAdmin):
    list_display = ["user", "is_active", "radius", "expires_at"]
    list_filter = ["is_active"]
    raw_id_fields = ["user"]
    exclude = ["location"]  # do not expose exact private location in admin lists
