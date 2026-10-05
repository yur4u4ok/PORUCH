from django.contrib import admin, messages

from apps.help_requests.constants import HelpRequestStatus
from apps.help_requests.models import HelpRequest
from apps.interactions.models import HelpResponse


class HelpResponseInline(admin.TabularInline):
    model = HelpResponse
    extra = 0
    raw_id_fields = ["helper"]
    readonly_fields = ["helper", "message", "status", "created_at"]
    can_delete = False


@admin.register(HelpRequest)
class HelpRequestAdmin(admin.ModelAdmin):
    list_display = ["title", "category", "urgency", "status", "author", "created_at", "expires_at"]
    list_filter = ["status", "category", "urgency", "reward_type", "created_at"]
    search_fields = ["title", "description", "author__email"]
    raw_id_fields = ["author", "selected_helper", "photos"]
    readonly_fields = [
        "created_at",
        "updated_at",
        "completed_at",
        "cancelled_at",
        "in_progress_at",
        "first_response_at",
    ]
    exclude = ["location"]  # exact location is private
    inlines = [HelpResponseInline]
    actions = ["moderate_cancel"]
    date_hierarchy = "created_at"

    @admin.action(description="Скасувати (модерація)")
    def moderate_cancel(self, request, queryset):
        from apps.help_requests.services.lifecycle import cancel_help_request

        count = 0
        for help_request in queryset.filter(status__in=[HelpRequestStatus.ACTIVE, HelpRequestStatus.IN_PROGRESS]):
            cancel_help_request(help_request.author, help_request.pk)
            count += 1
        self.message_user(request, f"Скасовано запитів: {count}", messages.SUCCESS)
