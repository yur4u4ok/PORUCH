from django.urls import path

from apps.reputation import views

urlpatterns = [
    path("users/<uuid:user_id>/thanks/", views.UserThanksView.as_view(), name="user-thanks"),
    path("users/<uuid:user_id>/reviews/", views.UserReviewsView.as_view(), name="user-reviews"),
]
