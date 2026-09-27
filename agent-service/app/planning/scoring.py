"""Ranks candidate places for a trip. Adapted from
trip-planner/backend/app/scoring.py + scoring_pipeline.py, simplified: that
version's recency_weighted_rating and crowd_index both need per-review
timestamp data trip-planner's Google-Places-backed POIs carried - Geoapify's
free tier doesn't return per-place ratings or review histories at all, so
there's nothing honest to weight there. What's kept from the original
pipeline: theme-tag relevance (Jaccard-style overlap) and a distance-from-
destination-center penalty, which are the two signals that don't depend on
data we don't have."""

from .geo import haversine_km
from .dwell import is_food_poi

THEME_CATEGORY_MAP = {
    "heritage": {"tourism.sights", "tourism.attraction"},
    "culture": {"tourism.sights", "entertainment"},
    "food": {"catering.restaurant", "catering.cafe", "catering.bar"},
    "adventure": {"entertainment", "leisure.park"},
    "nature": {"leisure.park"},
    "relaxation": {"leisure.park", "catering.cafe"},
    "nightlife": {"catering.bar", "entertainment"},
    "shopping": {"commercial.shopping_mall", "commercial.marketplace"},
}


def relevance_score(categories: list[str], theme_tags: list[str]) -> float:
    if not theme_tags:
        return 0.5
    wanted: set[str] = set()
    for tag in theme_tags:
        wanted |= THEME_CATEGORY_MAP.get(tag, set())
    if not wanted:
        return 0.5
    hits = sum(1 for c in categories if c in wanted)
    return min(1.0, 0.3 + hits * 0.35)


def score_candidates(places: list[dict], theme_tags: list[str], center: dict) -> list[dict]:
    """places: [{id,name,lat,lng,categories,address}]. Returns the same
    dicts with a `score` field added, sorted best-first."""
    scored = []
    for p in places:
        distance_km = haversine_km(center["lat"], center["lng"], p["lat"], p["lng"])
        distance_penalty = max(0.0, 1.0 - distance_km / 15.0)
        relevance = relevance_score(p.get("categories", []), theme_tags)
        score = relevance * 0.7 + distance_penalty * 0.3
        scored.append({**p, "score": round(score, 4), "is_food": is_food_poi(p.get("categories", []))})
    scored.sort(key=lambda p: p["score"], reverse=True)
    return scored
