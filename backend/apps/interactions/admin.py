from django.contrib import admin

from apps.interactions.models import HelpResponse


@admin.register(HelpResponse)
class HelpResponseAdmin(admin.ModelAdmin):
    list_display = ["help_request", "helper", "status", "created_at"]
    list_filter = ["status"]
    raw_id_fields = ["help_request", "helper"]
