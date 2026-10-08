"""Encryption of personal data at rest (phone numbers).

Values are encrypted with Fernet (AES-128-CBC + HMAC-SHA256), so a database dump alone does not
reveal them. A separate keyed hash (HMAC-SHA256) allows exact lookups without decrypting.
"""

import base64
import hashlib
import hmac
from functools import cache

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


@cache
def _key() -> bytes:
    if settings.FIELD_ENCRYPTION_KEY:
        return settings.FIELD_ENCRYPTION_KEY.encode()
    digest = hashlib.sha256(f"poruch.field-encryption:{settings.SECRET_KEY}".encode()).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt(value: str) -> str:
    return Fernet(_key()).encrypt(value.encode()).decode()


def decrypt(token: str) -> str | None:
    """None if the token cannot be read (e.g. the key was changed)."""
    try:
        return Fernet(_key()).decrypt(token.encode()).decode()
    except (InvalidToken, ValueError):
        return None


def blind_index(value: str) -> str:
    return hmac.new(_key(), value.encode(), hashlib.sha256).hexdigest()
