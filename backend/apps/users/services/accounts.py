"""Account lifecycle: registration, email verification, password reset, Google sign-in."""

import logging
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.translation import gettext as _

from apps.locations.models import City
from apps.users.models import Profile, SocialAccount, User
from apps.users.tasks import send_email
from common import analytics
from common.exceptions import Conflict, DomainError, ValidationFailed

logger = logging.getLogger(__name__)

EMAIL_VERIFY_SALT = "poruch.email-verify"


def _frontend_url(path: str, **params: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}?{urlencode(params)}"


def _create_profile(user: User, display_name: str, city: City | None) -> Profile:
    from apps.notifications.services.preferences import create_default_preferences

    profile = Profile.objects.create(user=user, display_name=display_name.strip()[:50], city=city)
    create_default_preferences(user)
    return profile


def _resolve_city(city_id) -> City | None:
    if city_id:
        city = City.objects.filter(id=city_id, is_active=True).first()
        if city is None:
            raise ValidationFailed(details={"city_id": [_("Невідоме місто.")]})
        return city
    # No implicit city: the client detects the real location (geolocation / IP) instead.
    return None


@transaction.atomic
def register_user(*, email: str, password: str, display_name: str, city_id=None) -> User:
    email = User.objects.normalize_email(email).strip().lower()
    if User.objects.filter(email__iexact=email).exists():
        raise Conflict(_("Користувач з таким email вже існує."), code="EMAIL_TAKEN")
    candidate = User(email=email)
    try:
        validate_password(password, user=candidate)
    except DjangoValidationError as exc:
        raise ValidationFailed(details={"password": list(exc.messages)}) from exc
    city = _resolve_city(city_id)
    try:
        user = User.objects.create_user(email=email, password=password)
    except IntegrityError as exc:
        raise Conflict(_("Користувач з таким email вже існує."), code="EMAIL_TAKEN") from exc
    _create_profile(user, display_name, city)
    send_verification_email(user)
    analytics.track(user_id=user.id, event="user_registered", properties={"method": "email"})
    return user


def make_email_verification_token(user: User) -> str:
    return signing.dumps({"uid": str(user.id), "email": user.email}, salt=EMAIL_VERIFY_SALT)


def send_verification_email(user: User) -> None:
    token = make_email_verification_token(user)
    link = _frontend_url("/auth/verify-email", token=token)
    body = _(
        "Вітаємо у Poruch!\n\nПідтвердіть свою електронну адресу, перейшовши за посиланням:\n{link}\n\n"
        "Якщо ви не реєструвалися — просто проігноруйте цей лист."
    ).format(link=link)
    subject = _("Підтвердження email — Poruch")
    transaction.on_commit(lambda: send_email.delay(user.email, subject, body))


def verify_email(token: str) -> User:
    try:
        data = signing.loads(token, salt=EMAIL_VERIFY_SALT, max_age=settings.EMAIL_VERIFICATION_MAX_AGE)
    except signing.SignatureExpired as exc:
        raise DomainError(_("Посилання застаріло."), code="TOKEN_EXPIRED") from exc
    except signing.BadSignature as exc:
        raise DomainError(_("Недійсне посилання."), code="TOKEN_INVALID") from exc
    user = User.objects.filter(id=data.get("uid"), email=data.get("email"), is_active=True).first()
    if user is None:
        raise DomainError(_("Недійсне посилання."), code="TOKEN_INVALID")
    if not user.email_verified:
        user.email_verified = True
        user.save(update_fields=["email_verified"])
        analytics.track(user_id=user.id, event="email_verified")
    return user


def request_password_reset(email: str) -> None:
    """Always succeeds silently to avoid account enumeration."""
    user = User.objects.filter(email__iexact=email.strip(), is_active=True).first()
    if user is None or not user.has_usable_password():
        return
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link = _frontend_url("/auth/reset-password", uid=uid, token=token)
    body = _(
        "Ви запросили відновлення пароля в Poruch.\n\nЩоб встановити новий пароль, перейдіть за посиланням:\n"
        "{link}\n\nЯкщо це були не ви — проігноруйте цей лист."
    ).format(link=link)
    send_email.delay(user.email, _("Відновлення пароля — Poruch"), body)


def confirm_password_reset(*, uid: str, token: str, password: str) -> User:
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)), is_active=True)
    except (User.DoesNotExist, ValueError, TypeError, DjangoValidationError) as exc:
        raise DomainError(_("Недійсне посилання."), code="TOKEN_INVALID") from exc
    if not default_token_generator.check_token(user, token):
        raise DomainError(_("Недійсне або застаріле посилання."), code="TOKEN_INVALID")
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise ValidationFailed(details={"password": list(exc.messages)}) from exc
    user.set_password(password)
    # Email ownership proven by the reset link.
    user.email_verified = True
    user.save(update_fields=["password", "email_verified"])
    from apps.users.services.tokens import revoke_all_tokens

    revoke_all_tokens(user)
    return user


def _verify_google_credential(credential: str) -> dict:
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    if not settings.GOOGLE_CLIENT_ID:
        raise DomainError(_("Вхід через Google не налаштовано."), code="GOOGLE_NOT_CONFIGURED")
    try:
        return id_token.verify_oauth2_token(credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID)
    except ValueError as exc:
        raise DomainError(_("Не вдалося перевірити обліковий запис Google."), code="GOOGLE_INVALID") from exc


@transaction.atomic
def authenticate_google(credential: str) -> tuple[User, bool]:
    """Return (user, created). Links Google identity to an existing account by verified email."""
    claims = _verify_google_credential(credential)
    if not claims.get("email") or not claims.get("email_verified"):
        raise DomainError(_("Email Google-акаунта не підтверджено."), code="GOOGLE_EMAIL_UNVERIFIED")
    uid = claims["sub"]
    email = claims["email"].lower()

    social = SocialAccount.objects.select_related("user").filter(provider="google", uid=uid).first()
    if social:
        user = social.user
        created = False
    else:
        existing: User | None = User.objects.filter(email__iexact=email).first()
        created = existing is None
        if existing is None:
            user = User.objects.create_user(email=email, password=None, email_verified=True)
            name = claims.get("given_name") or claims.get("name") or email.split("@")[0]
            _create_profile(user, name, _resolve_city(None))
            analytics.track(user_id=user.id, event="user_registered", properties={"method": "google"})
        else:
            user = existing
        SocialAccount.objects.create(user=user, provider="google", uid=uid)
    if not user.is_active:
        raise DomainError(
            _("Обліковий запис деактивовано."),
            code="ACCOUNT_INACTIVE",
        )
    if not user.email_verified:
        user.email_verified = True
        user.save(update_fields=["email_verified"])
    return user, created
