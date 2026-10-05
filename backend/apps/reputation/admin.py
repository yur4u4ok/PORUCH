from django.contrib import admin

from apps.reputation.models import ThankYou


@admin.register(ThankYou)
class ThankYouAdmin(admin.ModelAdmin):
    list_display = ["from_user", "to_user", "help_request", "created_at"]
    raw_id_fields = ["from_user", "to_user", "help_request"]
