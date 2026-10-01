from django.contrib import admin
from django.utils import timezone

from apps.moderation.models import Report, UserBlock


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ["id", "reason", "status", "reporter", "target_user", "help_request", "created_at"]
    list_filter = ["status", "reason", "created_at"]
    search_fields = ["reporter__email", "target_user__email", "description"]
    raw_id_fields = ["reporter", "target_user", "help_request", "message"]
    readonly_fields = ("reporter", "target_user", "help_request", "message", "reason", "description", "created_at")
    fields = (*readonly_fields, "status", "moderator_note", "resolved_at")
    actions = ["mark_resolved", "mark_dismissed", "mark_in_review"]

    def _set(self, queryset, status):
        resolved = timezone.now() if status in (Report.Status.RESOLVED, Report.Status.DISMISSED) else None
        queryset.update(status=status, resolved_at=resolved)

    @admin.action(description="Позначити як вирішені")
    def mark_resolved(self, request, queryset):
        self._set(queryset, Report.Status.RESOLVED)

    @admin.action(description="Відхилити")
    def mark_dismissed(self, request, queryset):
        self._set(queryset, Report.Status.DISMISSED)

    @admin.action(description="Взяти в роботу")
    def mark_in_review(self, request, queryset):
        self._set(queryset, Report.Status.IN_REVIEW)


@admin.register(UserBlock)
class UserBlockAdmin(admin.ModelAdmin):
    list_display = ["blocker", "blocked", "created_at"]
    raw_id_fields = ["blocker", "blocked"]
