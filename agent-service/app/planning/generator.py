"""Top-level orchestrator: structured trip params in, a full day-by-day plan
out. Ported from trip-planner/backend/app/graph.py's
intake -> retrieve -> score -> select_hotel -> sequence pipeline, minus the
`profile_fusion`/`enrich`/`validate`-with-retry-loop steps (those leaned on
per-user trip history and Google-Places-grade POI data this port doesn't
have - see scoring.py's docstring). Candidate places come from Geoapify via
toure's own /api/places/* routes, not a direct external API call, so this
function takes a NextClient the same way the other agent-service tools do."""

from datetime import datetime, timedelta

from ..next_client import NextClient
from .geo import centroid, haversine_km
from .scoring import score_candidates
from .sequencing import build_day, select_hotel, simple_kmeans

HOTEL_CATEGORY = "accommodation.hotel"
POI_CATEGORIES = "tourism.sights,tourism.attraction,entertainment,catering.restaurant,catering.cafe,catering.bar,leisure.park"


MAX_ACTIVITIES_PER_DAY = 4


class PlanGenerationError(Exception):
    pass


def _clean(places: list[dict]) -> list[dict]:
    """Geoapify returns unnamed/one-letter and duplicate entries - drop them
    so they never reach the itinerary."""
    seen: set[str] = set()
    out = []
    for p in places:
        name = (p.get("name") or "").strip()
        key = name.lower()
        if len(name) < 3 or key in seen or not name.isascii():
            continue
        seen.add(key)
        out.append(p)
    return out


def _nearest_unused(food: list[dict], anchor: dict, used: set[str]) -> dict | None:
    candidates = [f for f in food if f["id"] not in used]
    if not candidates:
        return None
    best = min(candidates, key=lambda f: haversine_km(anchor["lat"], anchor["lng"], f["lat"], f["lng"]) - f["score"])
    used.add(best["id"])
    return best


async def generate_plan(client: NextClient, destination: str, start_date: str, end_date: str, budget: float, theme_tags: list[str]) -> dict:
    try:
        center = await client.get("/api/places/geocode", {"q": destination})
    except Exception as exc:
        raise PlanGenerationError(f"Could not find a location for '{destination}'.") from exc

    pois_raw = await client.get("/api/places/nearby", {"lat": center["lat"], "lng": center["lng"], "categories": POI_CATEGORIES, "radius": 15000, "limit": 60})
    hotels_raw = await client.get("/api/places/nearby", {"lat": center["lat"], "lng": center["lng"], "categories": HOTEL_CATEGORY, "radius": 10000, "limit": 20})

    places = pois_raw.get("places", [])
    hotel_candidates = hotels_raw.get("places", [])
    if not places:
        raise PlanGenerationError(f"Couldn't find enough places around '{destination}' to build a plan yet.")

    scored = score_candidates(_clean(places), theme_tags, center)
    activities = [p for p in scored if not p["is_food"]]
    food = [p for p in scored if p["is_food"]]

    num_days = max(1, (datetime.fromisoformat(end_date) - datetime.fromisoformat(start_date)).days + 1)
    top_activities = activities[: num_days * MAX_ACTIVITIES_PER_DAY]

    clusters = simple_kmeans(top_activities, num_days)
    while len(clusters) < num_days:
        clusters.append([])
    top_candidates = top_activities

    used_food: set[str] = set()
    days: list[list[dict]] = []
    total_cost = 0
    for i in range(num_days):
        date_str = (datetime.fromisoformat(start_date) + timedelta(days=i)).strftime("%Y-%m-%d")
        cluster = clusters[i]
        anchor = centroid(cluster) if cluster else center
        lunch = _nearest_unused(food, anchor, used_food)
        dinner = _nearest_unused(food, anchor, used_food)
        cards = build_day(i, date_str, cluster, lunch=lunch, dinner=dinner)
        total_cost += sum(c["typicalSpend"] for c in cards)
        days.append(cards)

    hotel = select_hotel(scored, hotel_candidates)

    notes = [f"Grouped {len(top_candidates)} nearby places into {num_days} geographically-coherent days."]
    if theme_tags:
        notes.append(f"Favored places matching: {', '.join(theme_tags)}.")

    conflicts = []
    if budget and total_cost > budget:
        conflicts.append({"level": "warning", "text": f"Estimated cost ({round(total_cost)}) is above your budget ({round(budget)})."})

    return {
        "days": days,
        "hotel": hotel,
        "totalCost": total_cost,
        "narrative": f"A {num_days}-day plan around {destination}, built from {len(places)} nearby places.",
        "notes": notes,
        "conflicts": conflicts,
    }
