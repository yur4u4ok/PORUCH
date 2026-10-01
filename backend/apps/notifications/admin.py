from django.contrib import admin

from apps.notifications.models import Notification, NotificationPreference, PushSubscription


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["user", "type", "title", "created_at", "read_at", "push_sent_at"]
    list_filter = ["type"]
    search_fields = ["user__email"]
    raw_id_fields = ["user", "help_request"]


@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ["user", "created_at", "last_used_at", "failure_count"]
    raw_id_fields = ["user"]
    exclude = ["p256dh", "auth"]  # never expose push secrets


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ["user", "notification_radius", "push_enabled", "email_enabled"]
    raw_id_fields = ["user"]
    exclude = ["location"]
