from django.urls import path

from apps.moderation import views

urlpatterns = [
    path("support/", views.SupportMessageView.as_view(), name="support"),
    path("reports/", views.ReportCreateView.as_view(), name="reports"),
    path("blocks/", views.BlockListCreateView.as_view(), name="blocks"),
    path("blocks/<uuid:user_id>/", views.BlockDeleteView.as_view(), name="block-delete"),
]
