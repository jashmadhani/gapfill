from app.planning.geo import estimate_travel_minutes, haversine_km, optimize_route
from app.planning.dwell import estimate_dwell_minutes, is_food_poi
from app.planning.scoring import relevance_score, score_candidates
from app.planning.sequencing import build_day, select_hotel, simple_kmeans


def test_haversine_known_distance():
    # Roughly Udaipur City Palace to Lake Pichola boat dock - a few hundred meters.
    d = haversine_km(24.5764, 73.6835, 24.5711, 73.6789)
    assert 0.3 < d < 1.5


def test_estimate_travel_minutes_scales_with_distance():
    assert estimate_travel_minutes(0.5) < estimate_travel_minutes(5) < estimate_travel_minutes(20)


def test_optimize_route_visits_every_point_once():
    points = [{"lat": 0, "lng": 0}, {"lat": 0, "lng": 5}, {"lat": 0, "lng": 1}, {"lat": 0, "lng": 3}]
    ordered = optimize_route(points)
    assert len(ordered) == len(points)
    assert {p["lng"] for p in ordered} == {p["lng"] for p in points}


def test_is_food_poi():
    assert is_food_poi(["catering.restaurant"])
    assert not is_food_poi(["tourism.attraction"])


def test_estimate_dwell_minutes_has_sane_bounds():
    d = estimate_dwell_minutes(["tourism.attraction"])
    assert d["min"] < d["typical"] < d["max"]


def test_relevance_score_favors_matching_theme():
    heritage_score = relevance_score(["tourism.sights"], ["heritage"])
    unrelated_score = relevance_score(["catering.bar"], ["heritage"])
    assert heritage_score > unrelated_score


def test_score_candidates_sorts_best_first():
    center = {"lat": 0, "lng": 0}
    places = [
        {"id": "a", "name": "Far attraction", "lat": 1.0, "lng": 1.0, "categories": ["tourism.attraction"]},
        {"id": "b", "name": "Near attraction", "lat": 0.01, "lng": 0.01, "categories": ["tourism.attraction"]},
    ]
    scored = score_candidates(places, ["heritage"], center)
    assert scored[0]["id"] == "b"
    assert scored[0]["score"] >= scored[1]["score"]


def test_simple_kmeans_splits_into_requested_groups():
    points = [{"lat": i * 0.01, "lng": 0, "id": str(i), "name": f"p{i}"} for i in range(9)]
    clusters = simple_kmeans(points, 3)
    assert len(clusters) <= 3
    assert sum(len(c) for c in clusters) == len(points)


def test_build_day_produces_ordered_cards_with_valid_times():
    places = [
        {"id": "p1", "name": "Museum", "lat": 0, "lng": 0, "categories": ["tourism.attraction"]},
        {"id": "p2", "name": "Cafe", "lat": 0.05, "lng": 0.05, "categories": ["catering.cafe"]},
    ]
    cards = build_day(0, "2026-10-01", places)
    assert len(cards) >= 2
    for card in cards:
        assert card["startTime"] < card["endTime"]
        assert card["status"] == "suggested"
        assert card["locked"] is False


def test_select_hotel_picks_nearest_to_centroid():
    scored = [{"lat": 0, "lng": 0, "score": 1.0}, {"lat": 0.02, "lng": 0.02, "score": 0.8}]
    hotels = [
        {"id": "far", "name": "Far Hotel", "lat": 5, "lng": 5, "address": "far"},
        {"id": "near", "name": "Near Hotel", "lat": 0.01, "lng": 0.01, "address": "near"},
    ]
    hotel = select_hotel(scored, hotels)
    assert hotel is not None
    assert hotel["name"] == "Near Hotel"


def test_select_hotel_returns_none_without_candidates():
    assert select_hotel([{"lat": 0, "lng": 0, "score": 1.0}], []) is None
