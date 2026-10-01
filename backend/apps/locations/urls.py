from django.urls import path

from apps.locations import views

urlpatterns = [
    path("cities/", views.CityListView.as_view(), name="cities"),
    path("availability/", views.AvailabilityView.as_view(), name="availability"),
]
