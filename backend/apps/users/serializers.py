from rest_framework import serializers

from apps.locations.serializers import CitySerializer
from apps.media.serializers import MediaSerializer
from apps.users.models import Capability, User


class CapabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Capability
        fields = ["code", "kind", "category", "emoji"]


class PublicUserSerializer(serializers.Serializer):
    """Public information only. Respects the user's privacy settings."""

    id = serializers.UUIDField(read_only=True)
    display_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    helped_count = serializers.IntegerField(source="profile.helped_count", read_only=True)
    thanks_received_count = serializers.IntegerField(source="profile.thanks_received_count", read_only=True)
    member_since = serializers.DateTimeField(source="date_joined", read_only=True)
    is_verified = serializers.BooleanField(source="email_verified", read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    def get_display_name(self, user: User) -> str | None:
        profile = user.profile
        return profile.display_name if profile.show_name else None

    def get_avatar(self, user: User) -> dict | None:
        profile = user.profile
        if not profile.show_avatar or profile.avatar is None:
            return None
        return MediaSerializer(profile.avatar).data


class PublicProfileSerializer(PublicUserSerializer):
    capabilities = serializers.SerializerMethodField()
    custom_items = serializers.ListField(source="profile.custom_items", child=serializers.CharField(), read_only=True)

    def get_capabilities(self, user: User) -> list[dict]:
        caps = [uc.capability for uc in user.user_capabilities.all()]
        return list(CapabilitySerializer(caps, many=True).data)


class MeSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    email = serializers.EmailField(read_only=True)
    email_verified = serializers.BooleanField(read_only=True)
    date_joined = serializers.DateTimeField(read_only=True)
    display_name = serializers.CharField(source="profile.display_name", max_length=50)
    avatar = serializers.SerializerMethodField()
    city = CitySerializer(source="profile.city", read_only=True, allow_null=True)
    show_name = serializers.BooleanField(source="profile.show_name")
    show_avatar = serializers.BooleanField(source="profile.show_avatar")
    onboarding_completed = serializers.BooleanField(source="profile.onboarding_completed")
    custom_items = serializers.ListField(source="profile.custom_items", child=serializers.CharField(), read_only=True)
    helped_count = serializers.IntegerField(source="profile.helped_count", read_only=True)
    thanks_received_count = serializers.IntegerField(source="profile.thanks_received_count", read_only=True)
    has_password = serializers.SerializerMethodField()

    def get_avatar(self, user: User) -> dict | None:
        avatar = user.profile.avatar
        return MediaSerializer(avatar).data if avatar else None

    def get_has_password(self, user: User) -> bool:
        return user.has_usable_password()


class MeUpdateSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=50, required=False)
    avatar_id = serializers.UUIDField(required=False, allow_null=True)
    city_id = serializers.UUIDField(required=False, allow_null=True)
    show_name = serializers.BooleanField(required=False)
    show_avatar = serializers.BooleanField(required=False)
    onboarding_completed = serializers.BooleanField(required=False)
    custom_items = serializers.ListField(
        child=serializers.CharField(max_length=40, allow_blank=True), required=False, max_length=10
    )


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    display_name = serializers.CharField(max_length=50)
    city_id = serializers.UUIDField(required=False, allow_null=True)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, max_length=128)


class TokenSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=1024)


class GoogleAuthSerializer(serializers.Serializer):
    credential = serializers.CharField(max_length=4096)


class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=64)
    token = serializers.CharField(max_length=128)
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)


class CapabilityCodesSerializer(serializers.Serializer):
    codes = serializers.ListField(child=serializers.CharField(max_length=40), max_length=50)
