from django.urls import path

from apps.notifications import views

urlpatterns = [
    path("notifications/", views.NotificationListView.as_view(), name="notifications"),
    path("notifications/read-all/", views.NotificationReadAllView.as_view(), name="notifications-read-all"),
    path("notifications/<uuid:notification_id>/read/", views.NotificationReadView.as_view(), name="notification-read"),
    path("push-subscriptions/", views.PushSubscriptionCreateView.as_view(), name="push-subscriptions"),
    path(
        "push-subscriptions/<int:subscription_id>/",
        views.PushSubscriptionDeleteView.as_view(),
        name="push-subscription-delete",
    ),
    path("me/preferences/", views.PreferencesView.as_view(), name="me-preferences"),
]
