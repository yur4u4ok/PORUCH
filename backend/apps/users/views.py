import contextlib

from django.conf import settings
from django.contrib.auth import authenticate
from django.db.models import Prefetch
from django.utils.decorators import method_decorator
from django.utils.translation import gettext as _
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.moderation.selectors import is_blocked_between
from apps.users import serializers as s
from apps.users.cookies import clear_auth_cookies, set_auth_cookies
from apps.users.models import Capability, User, UserCapability
from apps.users.selectors import users_with_profile
from apps.users.services import accounts, profile
from apps.users.services.tokens import issue_tokens
from common import analytics
from common.exceptions import DomainError, NotFound
from common.permissions import IsAuthenticatedUser
from common.throttling import LoginThrottle, PasswordResetThrottle, RegisterThrottle


def _me(user: User) -> dict:
    return s.MeSerializer(users_with_profile().select_related("profile__city").get(pk=user.pk)).data


@method_decorator(ensure_csrf_cookie, name="get")
class CsrfView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    @extend_schema(responses={204: None})
    def get(self, request):
        return Response(status=status.HTTP_204_NO_CONTENT)


class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [RegisterThrottle]

    @extend_schema(request=s.RegisterSerializer, responses={201: s.MeSerializer})
    def post(self, request):
        ser = s.RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = dict(ser.validated_data)
        data.pop("age_confirmed")
        user = accounts.register_user(**data)
        response = Response(_me(user), status=status.HTTP_201_CREATED)
        return set_auth_cookies(response, issue_tokens(user))


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [LoginThrottle]

    @extend_schema(request=s.LoginSerializer, responses={200: s.MeSerializer})
    def post(self, request):
        ser = s.LoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = authenticate(request, email=ser.validated_data["email"].lower(), password=ser.validated_data["password"])
        if user is None:
            raise DomainError(_("Неправильний email або пароль."), code="INVALID_CREDENTIALS")
        analytics.track(user_id=user.id, event="user_logged_in")
        return set_auth_cookies(Response(_me(user)), issue_tokens(user))


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        raw = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if raw:
            with contextlib.suppress(TokenError):
                RefreshToken(raw).blacklist()
        return clear_auth_cookies(Response(status=status.HTTP_204_NO_CONTENT))


class RefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        raw = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        try:
            if not raw:
                raise TokenError("missing")
            old = RefreshToken(raw)
            user = User.objects.get(id=old["user_id"], is_active=True)
            old.blacklist()
        except (TokenError, User.DoesNotExist, KeyError):
            response = Response(
                {"code": "NOT_AUTHENTICATED", "message": _("Сесію завершено."), "details": {}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            return clear_auth_cookies(response)
        return set_auth_cookies(Response(status=status.HTTP_204_NO_CONTENT), issue_tokens(user))


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    @extend_schema(request=s.TokenSerializer, responses={200: None})
    def post(self, request):
        ser = s.TokenSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        accounts.verify_email(ser.validated_data["token"])
        return Response({"verified": True})


class ResendVerificationView(APIView):
    permission_classes = [IsAuthenticatedUser]
    throttle_classes = [PasswordResetThrottle]

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        if not request.user.email_verified:
            accounts.send_verification_email(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class GoogleAuthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [LoginThrottle]

    @extend_schema(request=s.GoogleAuthSerializer, responses={200: s.MeSerializer})
    def post(self, request):
        ser = s.GoogleAuthSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        credential = data.get("credential") or accounts.exchange_google_code(data["code"])
        user, created = accounts.authenticate_google(credential)
        response = Response(_me(user), status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        return set_auth_cookies(response, issue_tokens(user))


class PasswordResetView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [PasswordResetThrottle]

    @extend_schema(request=s.PasswordResetSerializer, responses={204: None})
    def post(self, request):
        ser = s.PasswordResetSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        accounts.request_password_reset(ser.validated_data["email"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [PasswordResetThrottle]

    @extend_schema(request=s.PasswordResetConfirmSerializer, responses={204: None})
    def post(self, request):
        ser = s.PasswordResetConfirmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        accounts.confirm_password_reset(**ser.validated_data)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticatedUser]

    @extend_schema(responses=s.MeSerializer)
    def get(self, request):
        return Response(_me(request.user))

    @extend_schema(request=s.MeUpdateSerializer, responses=s.MeSerializer)
    def patch(self, request):
        ser = s.MeUpdateSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        profile.update_profile(request.user, ser.validated_data)
        return Response(_me(request.user))


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticatedUser]
    throttle_classes = [LoginThrottle]

    @extend_schema(request=s.PasswordChangeSerializer, responses=s.MeSerializer)
    def post(self, request):
        ser = s.PasswordChangeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        accounts.change_password(
            request.user, ser.validated_data.get("current_password"), ser.validated_data["new_password"]
        )
        return set_auth_cookies(Response(_me(request.user)), issue_tokens(request.user))


class EmailChangeView(APIView):
    permission_classes = [IsAuthenticatedUser]
    throttle_classes = [RegisterThrottle]

    @extend_schema(request=s.EmailChangeSerializer, responses=s.MeSerializer)
    def post(self, request):
        ser = s.EmailChangeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        accounts.request_email_change(request.user, ser.validated_data["email"], ser.validated_data.get("password"))
        return Response(_me(request.user))


class DeactivateView(APIView):
    permission_classes = [IsAuthenticatedUser]

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        profile.deactivate_user(request.user)
        analytics.track(user_id=request.user.id, event="user_deactivated")
        return clear_auth_cookies(Response(status=status.HTTP_204_NO_CONTENT))


class CapabilityListView(APIView):
    @extend_schema(responses=s.CapabilitySerializer(many=True))
    def get(self, request):
        return Response(s.CapabilitySerializer(Capability.objects.filter(is_active=True), many=True).data)


class MyCapabilitiesView(APIView):
    def _list(self, user):
        caps = Capability.objects.filter(code__in=UserCapability.objects.filter(user=user).values("capability_id"))
        return Response(s.CapabilitySerializer(caps, many=True).data)

    @extend_schema(responses=s.CapabilitySerializer(many=True))
    def get(self, request):
        return self._list(request.user)

    @extend_schema(request=s.CapabilityCodesSerializer, responses=s.CapabilitySerializer(many=True))
    def put(self, request):
        ser = s.CapabilityCodesSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        profile.set_capabilities(request.user, ser.validated_data["codes"])
        return self._list(request.user)


class PublicProfileView(APIView):
    @extend_schema(responses=s.PublicProfileSerializer)
    def get(self, request, user_id):
        qs = users_with_profile().prefetch_related(
            Prefetch(
                "user_capabilities",
                queryset=UserCapability.objects.select_related("capability").filter(capability__is_active=True),
            )
        )
        user = get_object_or_404(qs, pk=user_id)
        if user.pk != request.user.pk and is_blocked_between(request.user, user):
            raise NotFound()
        return Response(s.PublicProfileSerializer(user).data)
