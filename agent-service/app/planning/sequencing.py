"""Turns a scored, flat list of candidate places into day-by-day EventCard
dicts (the exact shape toure/types/plan.ts's EventCard expects, so the
Next.js side can persist these with no reshaping). Adapted from
trip-planner/backend/app/sequencing.py's simple_kmeans + create_event_card +
_add_travel + sequence_plan, restructured around this app's card schema."""

import random
from datetime import datetime, timedelta

from .dwell import estimate_dwell_minutes, is_food_poi
from .geo import haversine_km, optimize_route

_TYPICAL_SPEND_BY_PREFIX = {
    "tourism": 300,
    "entertainment": 600,
    "leisure.park": 0,
    "catering.restaurant": 450,
    "catering.cafe": 180,
    "catering.fast_food": 200,
    "catering.bar": 500,
}
_DEFAULT_SPEND = 200


def _typical_spend(categories: list[str]) -> int:
    for cat in categories:
        for prefix, amount in _TYPICAL_SPEND_BY_PREFIX.items():
            if cat == prefix or cat.startswith(prefix + "."):
                return amount
    return _DEFAULT_SPEND


def simple_kmeans(points: list[dict], k: int, iterations: int = 12) -> list[list[dict]]:
    """Pure-Python k-means on (lat, lng) - clusters POIs into `k` day-groups
    so each day stays geographically coherent instead of zigzagging across
    town. No numpy/sklearn dependency for what's a tiny N (dozens of points)."""
    if k <= 1 or len(points) <= k:
        return [points] if points else []

    rng = random.Random(42)  # deterministic clustering for a given candidate set
    centroids = [dict(lat=p["lat"], lng=p["lng"]) for p in rng.sample(points, k)]

    clusters: list[list[dict]] = [[] for _ in range(k)]
    for _ in range(iterations):
        clusters = [[] for _ in range(k)]
        for p in points:
            best = min(range(k), key=lambda i: haversine_km(p["lat"], p["lng"], centroids[i]["lat"], centroids[i]["lng"]))
            clusters[best].append(p)
        for i, cluster in enumerate(clusters):
            if cluster:
                centroids[i] = {
                    "lat": sum(c["lat"] for c in cluster) / len(cluster),
                    "lng": sum(c["lng"] for c in cluster) / len(cluster),
                }
    return [c for c in clusters if c]


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def _make_card(item_id: str, card_type: str, title: str, activity_type: str, start: datetime, duration_min: int, location: dict | None, spend: int, fit_reason: str | None, extra: dict | None = None) -> dict:
    return {
        **(extra or {}),
        "itemId": item_id,
        "type": card_type,
        "startTime": _iso(start),
        "endTime": _iso(start + timedelta(minutes=duration_min)),
        "durationMin": duration_min,
        "title": title,
        "activityType": activity_type,
        "location": location,
        "minExpectedSpend": round(spend * 0.7),
        "typicalSpend": spend,
        "fitReason": fit_reason,
        "accessibilityIcons": [],
        "locked": False,
        "status": "suggested",
    }


def build_day(day_index: int, date_str: str, places: list[dict], start_hour: int = 9, lunch: dict | None = None, dinner: dict | None = None) -> list[dict]:
    """places: scored candidates already assigned to this day (from
    simple_kmeans). Returns an ordered list of EventCard dicts: activities
    with travel cards between them, and a lunch/food stop placed near
    midday."""
    if places and all(pl.get("prefHour") is not None for pl in places):
        # Catalog stops carry a preferred hour (sunrise walk early, sunset late): honour it,
        # nearest-neighbour ordering only breaks ties.
        ordered = sorted(optimize_route(places), key=lambda pl: pl["prefHour"])
    else:
        ordered = optimize_route(places)
    day_start = datetime.fromisoformat(date_str).replace(hour=start_hour, minute=0, second=0)
    cursor = day_start
    cards: list[dict] = []
    lunch_inserted = False
    prev_point: dict | None = None

    for i, place in enumerate(ordered):
        if place.get("prefHour") is not None:
            target = day_start.replace(hour=int(place["prefHour"]), minute=int((place["prefHour"] % 1) * 60))
            if cursor < target:
                # Waiting past lunchtime for a late stop: eat first rather than at 4pm.
                if not lunch_inserted and lunch and cursor.hour < 14 and target.hour >= 14:
                    cursor = _add_meal(cards, day_index, "lunch", lunch, max(cursor, day_start.replace(hour=12, minute=30)), prev_point)
                    lunch_inserted = True
                cursor = max(cursor, target)
        if prev_point is not None:
            distance_km = haversine_km(prev_point["lat"], prev_point["lng"], place["lat"], place["lng"])
            if distance_km > 0.6:
                from .geo import estimate_travel_minutes

                travel_min = estimate_travel_minutes(distance_km)
                cards.append(
                    _make_card(
                        f"d{day_index}_travel{i}", "travel", f"Travel to {place['name']}", "transfer", cursor, travel_min,
                        None, 0, None,
                    )
                )
                cursor += timedelta(minutes=travel_min)

        if not lunch_inserted and cursor.hour >= 12 and not is_food_poi(place.get("categories", [])):
            cursor = _add_meal(cards, day_index, "lunch", lunch, cursor, prev_point)
            lunch_inserted = True

        dwell = {"typical": place["dwellMin"]} if place.get("dwellMin") else estimate_dwell_minutes(place.get("categories", []))
        card_type = "meal" if is_food_poi(place.get("categories", [])) else "activity"
        if card_type == "meal":
            lunch_inserted = lunch_inserted or (11 <= cursor.hour <= 15)
        cards.append(
            _make_card(
                f"d{day_index}_{place['id']}", card_type, place["name"], place.get("activityType") or (place.get("categories") or ["poi"])[0],
                cursor, dwell["typical"], {"lat": place["lat"], "lng": place["lng"]},
                place["spend"] if place.get("spend") is not None else _typical_spend(place.get("categories", [])),
                place.get("fitReason"),
                {k: v for k, v in (("poiId", place.get("poiId")), ("photoRef", place.get("imageUrl"))) if v},
            )
        )
        cursor += timedelta(minutes=dwell["typical"])
        prev_point = place

    if not lunch_inserted and lunch:
        cursor = _add_meal(cards, day_index, "lunch", lunch, cursor, prev_point)
    if dinner and cursor.hour < 21:  # nothing left to eat after a late dinner-style stop
        if cursor.hour < 19:
            cursor = cursor.replace(hour=19, minute=0)
        _add_meal(cards, day_index, "dinner", dinner, cursor, prev_point)

    return cards


def _add_meal(cards: list[dict], day_index: int, slot: str, place: dict | None, cursor: datetime, prev_point: dict | None) -> datetime:
    if place:
        dwell = estimate_dwell_minutes(place.get("categories", []))["typical"]
        loc = {"lat": place["lat"], "lng": place["lng"]}
        cards.append(_make_card(f"d{day_index}_{slot}", "meal", place["name"], "food", cursor, dwell, loc, _typical_spend(place.get("categories", [])), slot.capitalize()))
    else:
        dwell = 60
        cards.append(_make_card(f"d{day_index}_{slot}", "meal", f"{slot.capitalize()} break", "food", cursor, dwell, prev_point, 400, "Midday break between stops"))
    return cursor + timedelta(minutes=dwell)


def select_hotel(scored_places: list[dict], hotel_candidates: list[dict]) -> dict | None:
    """Anchors a suggested stay near the weighted centroid of the top-scored
    activities, picking the closest real hotel Geoapify returned - ported
    from trip-planner's select_hotel."""
    top = scored_places[:15] or scored_places
    if not top or not hotel_candidates:
        return None
    weight = sum(p["score"] for p in top) or 1.0
    centroid_lat = sum(p["lat"] * p["score"] for p in top) / weight
    centroid_lng = sum(p["lng"] * p["score"] for p in top) / weight

    best = min(hotel_candidates, key=lambda h: haversine_km(centroid_lat, centroid_lng, h["lat"], h["lng"]))
    return {
        "name": best["name"],
        "location": {"lat": best["lat"], "lng": best["lng"]},
        "address": best.get("address"),
        "source": "geoapify",
    }
