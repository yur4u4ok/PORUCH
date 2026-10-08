from django.contrib import admin
from django.db.models import Count, Sum

from apps.reputation.models import Review, ThankYou
from apps.users.models import Profile


@admin.register(ThankYou)
class ThankYouAdmin(admin.ModelAdmin):
    list_display = ["from_user", "to_user", "help_request", "created_at"]
    raw_id_fields = ["from_user", "to_user", "help_request"]


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ["help_request", "from_user", "to_user", "rating", "created_at"]
    list_filter = ["rating"]
    raw_id_fields = ["help_request", "from_user", "to_user"]

    # Removing an abusive review (moderators only) keeps the person's rating in sync.
    def delete_model(self, request, obj):
        user_id = obj.to_user_id
        super().delete_model(request, obj)
        _recount(user_id)

    def delete_queryset(self, request, queryset):
        user_ids = set(queryset.values_list("to_user_id", flat=True))
        super().delete_queryset(request, queryset)
        for user_id in user_ids:
            _recount(user_id)


def _recount(user_id) -> None:
    totals = Review.objects.filter(to_user_id=user_id).aggregate(n=Count("id"), s=Sum("rating"))
    Profile.objects.filter(user_id=user_id).update(reviews_count=totals["n"], rating_sum=totals["s"] or 0)
