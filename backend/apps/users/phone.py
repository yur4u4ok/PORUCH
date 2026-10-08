"""Phone numbers: parsing to E.164 and encrypted storage on the user."""

import phonenumbers
from django.conf import settings
from django.utils.translation import gettext as _

from common import crypto
from common.exceptions import ValidationFailed


def normalize_phone(raw: str, region: str | None = None) -> str:
    """'+380 67 123 45 67' / '067 123 45 67' -> '+380671234567'. Raises ValidationFailed."""
    try:
        number = phonenumbers.parse(raw.strip(), (region or settings.PHONE_DEFAULT_REGION).upper())
    except phonenumbers.NumberParseException as exc:
        raise ValidationFailed(details={"phone": [_("Невірний номер телефону.")]}) from exc
    if not phonenumbers.is_valid_number(number):
        raise ValidationFailed(details={"phone": [_("Невірний номер телефону.")]})
    return phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)


def set_phone(user, raw: str | None, region: str | None = None) -> list[str]:
    """Store (or clear) the user's phone. Returns the changed field names for save()."""
    if not raw:
        user.phone_encrypted, user.phone_hash, user.phone_verified = "", "", False
    else:
        phone = normalize_phone(raw, region)
        if user.phone_hash != crypto.blind_index(phone):
            user.phone_encrypted = crypto.encrypt(phone)
            user.phone_hash = crypto.blind_index(phone)
            user.phone_verified = False
    return ["phone_encrypted", "phone_hash", "phone_verified"]


def get_phone(user) -> str | None:
    return crypto.decrypt(user.phone_encrypted) if user.phone_encrypted else None
