from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.urls import reverse
from django.utils.html import format_html

from apps.users.models import Capability, Profile, SocialAccount, User, UserCapability


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    raw_id_fields = ["avatar"]
    readonly_fields = ["helped_count", "thanks_received_count"]


class UserCapabilityInline(admin.TabularInline):
    model = UserCapability
    extra = 0


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["-date_joined"]
    list_display = ["email", "display_name", "email_verified", "is_active", "is_staff", "date_joined", "activity"]
    list_filter = ["is_active", "email_verified", "is_staff"]
    search_fields = ["email", "profile__display_name"]
    readonly_fields = ["date_joined", "last_login", "deactivated_at", "reports_link"]
    inlines = [ProfileInline, UserCapabilityInline]
    actions = ["deactivate_users"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Статус", {"fields": ("email_verified", "is_active", "deactivated_at", "reports_link")}),
        ("Права", {"fields": ("is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Дати", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "password1", "password2")}),)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("profile")

    @admin.display(description="Ім'я")
    def display_name(self, obj):
        return getattr(getattr(obj, "profile", None), "display_name", "")

    @admin.display(description="Активність")
    def activity(self, obj):
        url = reverse("admin:help_requests_helprequest_changelist") + f"?author__id__exact={obj.pk}"
        return format_html('<a href="{}">Запити</a>', url)

    @admin.display(description="Скарги")
    def reports_link(self, obj):
        url = reverse("admin:moderation_report_changelist") + f"?target_user__id__exact={obj.pk}"
        return format_html('<a href="{}">Скарги на користувача</a>', url)

    @admin.action(description="Деактивувати вибраних користувачів")
    def deactivate_users(self, request, queryset):
        from apps.users.services.profile import deactivate_user

        for user in queryset.filter(is_active=True):
            deactivate_user(user)
        self.message_user(request, "Користувачів деактивовано.", messages.SUCCESS)


@admin.register(Capability)
class CapabilityAdmin(admin.ModelAdmin):
    list_display = ["code", "kind", "category", "emoji", "sort_order", "is_active"]
    list_filter = ["kind", "category", "is_active"]


@admin.register(SocialAccount)
class SocialAccountAdmin(admin.ModelAdmin):
    list_display = ["user", "provider", "created_at"]
    raw_id_fields = ["user"]
