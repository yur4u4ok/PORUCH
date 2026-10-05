from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.locations.models import City
from apps.users.models import Capability, Profile, User, UserCapability
from common.exceptions import ValidationFailed


@transaction.atomic
def update_profile(user: User, data: dict) -> Profile:
    profile = user.profile
    fields: list[str] = []
    for name in ("display_name", "show_name", "show_avatar", "onboarding_completed"):
        if name in data:
            value = data[name]
            if name == "display_name":
                value = value.strip()
                if not value:
                    raise ValidationFailed(details={"display_name": [_("Ім'я не може бути порожнім.")]})
            setattr(profile, name, value)
            fields.append(name)
    if "custom_items" in data:
        items = [i.strip() for i in data["custom_items"] if i and i.strip()]
        items = list(dict.fromkeys(items))
        if len(items) > 10 or any(len(i) > 40 for i in items):
            raise ValidationFailed(details={"custom_items": [_("До 10 пунктів, кожен до 40 символів.")]})
        profile.custom_items = items
        fields.append("custom_items")
    if "city_id" in data:
        city = None
        if data["city_id"]:
            city = City.objects.filter(id=data["city_id"], is_active=True).first()
            if city is None:
                raise ValidationFailed(details={"city_id": [_("Невідоме місто.")]})
        profile.city = city
        fields.append("city")
    if "avatar_id" in data:
        from apps.media.services.media import get_ready_media_for_owner

        avatar_id = data["avatar_id"]
        profile.avatar = get_ready_media_for_owner(user, avatar_id, kind="AVATAR") if avatar_id else None
        fields.append("avatar")
    if fields:
        profile.save(update_fields=fields)
    return profile


@transaction.atomic
def set_capabilities(user: User, codes: list[str]) -> list[Capability]:
    codes = list(dict.fromkeys(codes))
    capabilities = list(Capability.objects.filter(code__in=codes, is_active=True))
    unknown = set(codes) - {c.code for c in capabilities}
    if unknown:
        raise ValidationFailed(details={"codes": [_("Невідомі можливості: ") + ", ".join(sorted(unknown))]})
    UserCapability.objects.filter(user=user).exclude(capability__code__in=codes).delete()
    existing = set(UserCapability.objects.filter(user=user).values_list("capability_id", flat=True))
    UserCapability.objects.bulk_create(
        [UserCapability(user=user, capability=c) for c in capabilities if c.code not in existing]
    )
    return capabilities


@transaction.atomic
def deactivate_user(user: User) -> None:
    """Deactivate account; keep historical interactions."""
    from apps.help_requests.services.lifecycle import cancel_open_requests_of_user
    from apps.interactions.services.responses import cancel_pending_responses_of_user
    from apps.locations.services.availability import deactivate_availability
    from apps.notifications.models import PushSubscription
    from apps.users.services.tokens import revoke_all_tokens

    user = User.objects.select_for_update().get(pk=user.pk)
    cancel_open_requests_of_user(user)
    cancel_pending_responses_of_user(user)
    deactivate_availability(user)
    PushSubscription.objects.filter(user=user).delete()
    revoke_all_tokens(user)
    user.is_active = False
    user.deactivated_at = timezone.now()
    user.save(update_fields=["is_active", "deactivated_at"])
