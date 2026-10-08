from django.urls import path

from apps.users import google_oauth, views

auth_urlpatterns = [
    path("csrf/", views.CsrfView.as_view(), name="auth-csrf"),
    path("register/", views.RegisterView.as_view(), name="auth-register"),
    path("login/", views.LoginView.as_view(), name="auth-login"),
    path("logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("refresh/", views.RefreshView.as_view(), name="auth-refresh"),
    path("verify-email/", views.VerifyEmailView.as_view(), name="auth-verify-email"),
    path("verify-email/resend/", views.ResendVerificationView.as_view(), name="auth-verify-email-resend"),
    path("google/", views.GoogleAuthView.as_view(), name="auth-google"),
    path("google/start/", google_oauth.google_start, name="auth-google-start"),
    path("google/callback/", google_oauth.google_callback, name="auth-google-callback"),
    path("password-reset/", views.PasswordResetView.as_view(), name="auth-password-reset"),
    path("password-reset/confirm/", views.PasswordResetConfirmView.as_view(), name="auth-password-reset-confirm"),
]

urlpatterns = [
    path("me/", views.MeView.as_view(), name="me"),
    path("me/deactivate/", views.DeactivateView.as_view(), name="me-deactivate"),
    path("me/email/", views.EmailChangeView.as_view(), name="me-email"),
    path("me/password/", views.PasswordChangeView.as_view(), name="me-password"),
    path("me/capabilities/", views.MyCapabilitiesView.as_view(), name="me-capabilities"),
    path("capabilities/", views.CapabilityListView.as_view(), name="capabilities"),
    path("users/<uuid:user_id>/", views.PublicProfileView.as_view(), name="user-profile"),
]
