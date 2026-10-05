from django.contrib import admin

from apps.media.models import Media


@admin.register(Media)
class MediaAdmin(admin.ModelAdmin):
    list_display = ["id", "owner", "kind", "status", "is_attached", "created_at"]
    list_filter = ["kind", "status", "is_attached"]
    raw_id_fields = ["owner"]
    readonly_fields = [f.name for f in Media._meta.fields]
