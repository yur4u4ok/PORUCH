from rest_framework import serializers

from apps.media import storage
from apps.media.models import Media


class MediaSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Media
        fields = ["id", "url", "thumbnail_url", "width", "height", "status"]

    def get_url(self, media: Media) -> str | None:
        return storage.presigned_get(media.key) if media.key else None

    def get_thumbnail_url(self, media: Media) -> str | None:
        return storage.presigned_get(media.thumbnail_key) if media.thumbnail_key else None


class UploadUrlRequestSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=Media.Kind.choices)
    content_type = serializers.CharField(max_length=50)
    size = serializers.IntegerField(min_value=1)


class UploadUrlResponseSerializer(serializers.Serializer):
    media_id = serializers.UUIDField()
    upload = serializers.DictField()


class ConfirmSerializer(serializers.Serializer):
    media_id = serializers.UUIDField()
