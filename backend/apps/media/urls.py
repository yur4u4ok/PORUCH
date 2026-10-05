from django.urls import path

from apps.media import views

urlpatterns = [
    path("media/upload-url/", views.UploadUrlView.as_view(), name="media-upload-url"),
    path("media/confirm/", views.ConfirmView.as_view(), name="media-confirm"),
    path("media/<uuid:media_id>/", views.MediaDetailView.as_view(), name="media-detail"),
]
