from typing import ClassVar

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.utils import timezone

from apps.help_requests.constants import Category
from common.models import UUIDModel


class UserManager(BaseUserManager["User"]):
    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra) -> "User":
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra) -> "User":
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email: str, password: str | None = None, **extra) -> "User":
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("email_verified", True)
        return self._create_user(email, password, **extra)


class User(UUIDModel, AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    email_verified = models.BooleanField(default=False)
    # A new address waiting for confirmation from that inbox; the login email changes only then.
    pending_email = models.EmailField(blank=True, default="")
    # Phone number, encrypted at rest (see common/crypto.py); phone_hash allows lookups.
    phone_encrypted = models.TextField(blank=True, default="")
    phone_hash = models.CharField(max_length=64, blank=True, default="", db_index=True)
    phone_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    deactivated_at = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = []

    class Meta:
        verbose_name = "користувач"
        verbose_name_plural = "користувачі"

    def __str__(self) -> str:
        return self.email


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile", primary_key=True)
    display_name = models.CharField(max_length=50)
    avatar = models.ForeignKey("media.Media", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    city = models.ForeignKey("locations.City", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    # Privacy
    show_name = models.BooleanField(default=True)
    show_avatar = models.BooleanField(default=True)
    onboarding_completed = models.BooleanField(default=False)
    # Free-text "Маю" items for things not in the catalog (used with HAS_OTHER).
    custom_items = ArrayField(models.CharField(max_length=40), default=list, blank=True)
    # Reputation counters (denormalised, updated by services with F() expressions)
    helped_count = models.PositiveIntegerField(default=0)
    thanks_received_count = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "профіль"
        verbose_name_plural = "профілі"

    def __str__(self) -> str:
        return self.display_name


class Capability(models.Model):
    class Kind(models.TextChoices):
        HELP = "HELP", "Можу допомогти"
        ITEM = "ITEM", "Маю"

    code = models.CharField(max_length=40, primary_key=True)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.HELP)
    category = models.CharField(max_length=20, choices=Category.choices)
    emoji = models.CharField(max_length=8, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["kind", "sort_order", "code"]
        verbose_name = "можливість"
        verbose_name_plural = "можливості"

    def __str__(self) -> str:
        return self.code


class UserCapability(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="user_capabilities")
    capability = models.ForeignKey(Capability, on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "capability"], name="unique_user_capability"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id}: {self.capability_id}"


class SocialAccount(models.Model):
    """External identity (Google now, Apple later)."""

    class Provider(models.TextChoices):
        GOOGLE = "google", "Google"
        APPLE = "apple", "Apple"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="social_accounts")
    provider = models.CharField(max_length=20, choices=Provider.choices)
    uid = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["provider", "uid"], name="unique_social_account"),
        ]

    def __str__(self) -> str:
        return f"{self.provider}:{self.user_id}"
