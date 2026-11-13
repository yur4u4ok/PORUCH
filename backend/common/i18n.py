"""Writing to a person in their own language (push notifications, emails), outside their request."""

from contextlib import contextmanager

from django.conf import settings
from django.utils import translation


def normalize_language(code: str | None) -> str:
    """App code («zh», «pt-BR», «uk-UA») → a supported Django language, Ukrainian by default."""
    if not code:
        return settings.LANGUAGE_CODE
    try:
        return translation.get_supported_language_variant(code.strip().lower())
    except LookupError:
        return settings.LANGUAGE_CODE


def language_of(user) -> str:
    profile = getattr(user, "profile", None)
    return normalize_language(getattr(profile, "language", None))


@contextmanager
def in_language_of(user):
    """Texts built inside come out in the user's language."""
    with translation.override(language_of(user)):
        yield
