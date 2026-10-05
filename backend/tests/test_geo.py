import pytest

from common.exceptions import ValidationFailed
from common.utils.geo import approximate_point, make_point, normalize_radius, round_distance, validate_coordinates


@pytest.mark.parametrize(
    ("lat", "lng", "acc"),
    [
        (91, 24, None),
        (-91, 24, None),
        (49, 181, None),
        ("abc", 24, None),
        (49, 24, -1),
        (49, 24, 10_000_000),
        (float("nan"), 24, None),
    ],
)
def test_validate_coordinates_rejects_invalid(lat, lng, acc):
    with pytest.raises(ValidationFailed):
        validate_coordinates(lat, lng, acc)


def test_validate_coordinates_ok():
    coords = validate_coordinates("49.8397", "24.0297", "20")
    assert coords.latitude == 49.8397 and coords.longitude == 24.0297 and coords.accuracy == 20
    point = coords.to_point()
    assert point.x == 24.0297 and point.y == 49.8397 and point.srid == 4326


def test_approximate_point_hides_exact_location_but_stays_close():
    exact = make_point(49.8397, 24.0297)
    approx = approximate_point(exact)
    assert (approx["latitude"], approx["longitude"]) != (exact.y, exact.x)
    assert abs(approx["latitude"] - exact.y) < 0.005
    assert abs(approx["longitude"] - exact.x) < 0.01
    # nearby points in the same cell produce the same approximation
    assert approximate_point(make_point(49.83971, 24.02971)) == approx


def test_round_distance():
    assert round_distance(None) is None
    assert round_distance(12) == 100
    assert round_distance(1249) == 1200
    assert round_distance(1251) == 1300


def test_normalize_radius(settings):
    assert normalize_radius(None) == settings.NEARBY_DEFAULT_RADIUS
    assert normalize_radius("500") == 500
    with pytest.raises(ValidationFailed):
        normalize_radius(700)
    with pytest.raises(ValidationFailed):
        normalize_radius("x")
