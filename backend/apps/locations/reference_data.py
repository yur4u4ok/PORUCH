"""Default development city. Used by the data migration and by test fixtures."""

from django.contrib.gis.geos import Point

DEFAULT_CITY = {
    "slug": "lviv",
    "name": "Львів",
    "country_code": "UA",
    "longitude": 24.0316,
    "latitude": 49.8429,
    "default_zoom": 13,
}


def seed_default_city(city_model) -> None:
    city_model.objects.update_or_create(
        slug=DEFAULT_CITY["slug"],
        defaults={
            "name": DEFAULT_CITY["name"],
            "country_code": DEFAULT_CITY["country_code"],
            "center": Point(DEFAULT_CITY["longitude"], DEFAULT_CITY["latitude"], srid=4326),
            "default_zoom": DEFAULT_CITY["default_zoom"],
            "is_default": True,
        },
    )
