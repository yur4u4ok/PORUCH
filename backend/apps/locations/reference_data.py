"""Default development city. Used by the data migration and by test fixtures."""

from django.contrib.gis.geos import Point

DEFAULT_CITY = {
    "slug": "lviv",
    "name": "Львів",
    "translations": {"en": "Lviv", "pl": "Lwów"},
    "country_code": "UA",
    "longitude": 24.0316,
    "latitude": 49.8429,
    "default_zoom": 13,
}


def seed_default_city(city_model) -> None:
    # Historical models in older migrations may not have newer fields yet.
    field_names = {f.name for f in city_model._meta.get_fields()}
    extra = {"translations": DEFAULT_CITY["translations"]} if "translations" in field_names else {}
    city_model.objects.update_or_create(
        slug=DEFAULT_CITY["slug"],
        defaults={
            **extra,
            "name": DEFAULT_CITY["name"],
            "country_code": DEFAULT_CITY["country_code"],
            "center": Point(DEFAULT_CITY["longitude"], DEFAULT_CITY["latitude"], srid=4326),
            "default_zoom": DEFAULT_CITY["default_zoom"],
            "is_default": True,
        },
    )
