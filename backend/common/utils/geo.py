"""Geographic helpers. All distance math happens in PostGIS; these only build/blur points."""

import math
from dataclasses import dataclass

from django.conf import settings
from django.contrib.gis.geos import Point

from common.exceptions import ValidationFailed

SRID = 4326


@dataclass(frozen=True)
class Coordinates:
    latitude: float
    longitude: float
    accuracy: float | None = None

    def to_point(self) -> Point:
        return make_point(self.latitude, self.longitude)


def make_point(latitude: float, longitude: float) -> Point:
    return Point(float(longitude), float(latitude), srid=SRID)


def validate_coordinates(latitude, longitude, accuracy=None) -> Coordinates:
    """Validate raw client input. Never trust the frontend blindly."""
    errors: dict[str, list[str]] = {}
    try:
        lat = float(latitude)
        if not math.isfinite(lat) or not -90 <= lat <= 90:
            raise ValueError
    except (TypeError, ValueError):
        errors["latitude"] = ["Latitude must be a number between -90 and 90."]
        lat = 0.0
    try:
        lng = float(longitude)
        if not math.isfinite(lng) or not -180 <= lng <= 180:
            raise ValueError
    except (TypeError, ValueError):
        errors["longitude"] = ["Longitude must be a number between -180 and 180."]
        lng = 0.0
    acc: float | None = None
    if accuracy not in (None, ""):
        try:
            acc = float(accuracy)
            if not math.isfinite(acc) or acc < 0 or acc > settings.LOCATION_MAX_ACCURACY_M:
                raise ValueError
        except (TypeError, ValueError):
            errors["accuracy"] = [f"Accuracy must be between 0 and {settings.LOCATION_MAX_ACCURACY_M} meters."]
    if errors:
        raise ValidationFailed("Invalid location", code="INVALID_LOCATION", details=errors)
    return Coordinates(lat, lng, acc)


def approximate_point(point: Point) -> dict[str, float]:
    """Snap a point to the centre of a fixed grid cell so exact position is not leaked."""
    grid = settings.APPROXIMATE_LOCATION_GRID_DEG
    lat_cell = math.floor(point.y / grid) * grid + grid / 2
    # Keep cells roughly square: widen longitude step by 1/cos(lat). Use the cell centre latitude
    # so every point inside a latitude row shares the same longitude grid.
    lng_grid = grid / max(math.cos(math.radians(lat_cell)), 0.1)
    lng_cell = math.floor(point.x / lng_grid) * lng_grid + lng_grid / 2
    return {"latitude": round(lat_cell, 5), "longitude": round(lng_cell, 5)}


def round_distance(meters: float | None) -> int | None:
    if meters is None:
        return None
    step = settings.APPROXIMATE_DISTANCE_STEP_M
    return max(step, int(round(meters / step) * step))


def point_to_dict(point: Point) -> dict[str, float]:
    return {"latitude": point.y, "longitude": point.x}


def normalize_radius(radius, default: int | None = None) -> int:
    default = default or settings.NEARBY_DEFAULT_RADIUS
    if radius in (None, ""):
        return default
    try:
        value = int(radius)
    except (TypeError, ValueError) as exc:
        raise ValidationFailed(details={"radius": ["Radius must be an integer."]}) from exc
    if value not in settings.NEARBY_ALLOWED_RADII:
        raise ValidationFailed(details={"radius": [f"Allowed values: {settings.NEARBY_ALLOWED_RADII}."]})
    return value
