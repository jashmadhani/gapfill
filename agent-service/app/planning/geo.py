"""Pure geometry - no I/O. Ported from trip-planner/backend/app/geo.py."""

import math


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def estimate_travel_minutes(distance_km: float) -> int:
    """Rough door-to-door estimate for a mixed walk/auto-rickshaw/cab trip in
    a dense town - not a routing engine, just enough to space cards out
    realistically without a paid directions API."""
    if distance_km <= 0.8:
        return 10
    if distance_km <= 2.5:
        return 15
    speed_kmh = 22.0
    return max(15, round((distance_km / speed_kmh) * 60))


def travel_minutes_between(a: dict, b: dict) -> int:
    return estimate_travel_minutes(haversine_km(a["lat"], a["lng"], b["lat"], b["lng"]))


def optimize_route(points: list[dict], start: dict | None = None) -> list[dict]:
    """Nearest-neighbor ordering - not optimal TSP, but removes the obvious
    back-and-forth zigzag a purely category-sorted list would have."""
    remaining = list(points)
    if not remaining:
        return []
    ordered = []
    current = start or remaining[0]
    if start is None:
        ordered.append(remaining.pop(0))
        current = ordered[0]
    while remaining:
        remaining.sort(key=lambda p: haversine_km(current["lat"], current["lng"], p["lat"], p["lng"]))
        nxt = remaining.pop(0)
        ordered.append(nxt)
        current = nxt
    return ordered


def centroid(points: list[dict]) -> dict:
    lat = sum(p["lat"] for p in points) / len(points)
    lng = sum(p["lng"] for p in points) / len(points)
    return {"lat": lat, "lng": lng}
