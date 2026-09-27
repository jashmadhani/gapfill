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
from .catalog import build_considered, excluded_reason, fit_reason, score_catalog_place, to_place, trip_weekdays
from .geo import centroid, haversine_km
from .scoring import score_candidates
from .sequencing import _typical_spend, build_day, select_hotel, simple_kmeans
from .dwell import estimate_dwell_minutes

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


def _balance(clusters: list[list[dict]], cap: int) -> list[list[dict]]:
    """k-means can put nine stops in one day and one in another. Move the stop farthest from its
    day's centre into the nearest day with room until nobody is over the cap."""
    clusters = [list(c) for c in clusters]
    for _ in range(200):
        big = next((c for c in clusters if len(c) > cap), None)
        if big is None:
            break
        cen = centroid(big)
        stop = max(big, key=lambda q: haversine_km(cen["lat"], cen["lng"], q["lat"], q["lng"]))
        room = [c for c in clusters if c is not big and len(c) < cap]
        if not room:
            break
        big.remove(stop)
        best = min(room, key=lambda c: haversine_km(stop["lat"], stop["lng"], *(lambda k: (k["lat"], k["lng"]))(centroid(c))) if c else 3.0)
        best.append(stop)
    return clusters


def _nearest_unused(food: list[dict], anchor: dict, used: set[str]) -> dict | None:
    candidates = [f for f in food if f["id"] not in used]
    if not candidates:
        return None
    best = min(candidates, key=lambda f: haversine_km(anchor["lat"], anchor["lng"], f["lat"], f["lng"]) - f["score"])
    used.add(best["id"])
    return best


async def generate_plan(client: NextClient, destination: str, start_date: str, end_date: str, budget: float, theme_tags: list[str], group_type: str = "solo") -> dict:
    try:
        center = await client.get("/api/places/geocode", {"q": destination})
    except Exception as exc:
        raise PlanGenerationError(f"Could not find a location for '{destination}'.") from exc

    catalog = await _load_catalog(client, destination)
    if catalog:
        # Curated destination: real prices, ratings and hours. Meals still come from live results.
        center = catalog["area"].get("location") or center
        food_categories = "catering.restaurant,catering.cafe"
        pois_raw = await client.get("/api/places/nearby", {"lat": center["lat"], "lng": center["lng"], "categories": food_categories, "radius": 8000, "limit": 40})
    else:
        pois_raw = await client.get("/api/places/nearby", {"lat": center["lat"], "lng": center["lng"], "categories": POI_CATEGORIES, "radius": 15000, "limit": 60})
    hotels_raw = await client.get("/api/places/nearby", {"lat": center["lat"], "lng": center["lng"], "categories": HOTEL_CATEGORY, "radius": 10000, "limit": 20})

    places = pois_raw.get("places", [])
    hotel_candidates = hotels_raw.get("places", [])
    if not places and not catalog:
        raise PlanGenerationError(f"Couldn't find enough places around '{destination}' to build a plan yet.")

    num_days = max(1, (datetime.fromisoformat(end_date) - datetime.fromisoformat(start_date)).days + 1)
    slots = num_days * MAX_ACTIVITIES_PER_DAY

    scored = score_candidates(_clean(places), theme_tags, center) if places else []
    food = [p for p in scored if p["is_food"]]
    excluded: list[tuple[dict, str]] = []
    if catalog:
        weekdays = trip_weekdays(start_date, num_days)
        eligible: list[dict] = []
        for raw in catalog["pois"]:
            place = to_place(raw)
            why = excluded_reason(place, group_type=group_type, budget=budget, weekdays=weekdays)
            if why:
                excluded.append((place, why))
            else:
                eligible.append(score_catalog_place(place, theme_tags, center))
        activities = sorted(eligible, key=lambda p: p["score"], reverse=True)
        for p in activities[:slots]:
            p["fitReason"] = fit_reason(p, theme_tags)
        scored = activities + food  # hotel anchoring uses the best-scored stops
    else:
        activities = [p for p in scored if not p["is_food"]]
    top_activities = activities[:slots]

    clusters = simple_kmeans(top_activities, num_days)
    while len(clusters) < num_days:
        clusters.append([])
    clusters = _balance(clusters, MAX_ACTIVITIES_PER_DAY)
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

    if catalog:
        considered = build_considered(activities, top_activities, excluded, slots=slots, theme_tags=theme_tags)
        total_seen = len(catalog["pois"])
        notes.append(f"Chose {len(top_activities)} of {total_seen} curated experiences in {catalog['area']['name']}; {len(considered)} near-misses are listed under Left out.")
    else:
        considered = _considered_from_live(activities, top_activities, slots, theme_tags)
        total_seen = len(places)

    return {
        "days": days,
        "hotel": hotel,
        "totalCost": total_cost,
        "narrative": f"A {num_days}-day plan around {destination}, built from {total_seen} places considered.",
        "notes": notes,
        "conflicts": conflicts,
        "considered": considered,
    }


async def _load_catalog(client: NextClient, destination: str) -> dict | None:
    """Curated experiences for the destination, or None when it isn't in the catalog (or the
    lookup fails, in which case the live-Geoapify pipeline runs exactly as before)."""
    try:
        data = await client.get("/api/agent/catalog", {"q": destination})
    except Exception:
        return None
    if not data.get("area") or len(data.get("pois", [])) < 6:
        return None
    return data


def _considered_from_live(activities: list[dict], selected: list[dict], slots: int, theme_tags: list[str]) -> list[dict]:
    """Left-out record for destinations without curated data: Geoapify has no ratings or prices,
    so prices are category estimates and marked as such."""
    chosen = {p["id"] for p in selected}
    out = []
    for rank, p in enumerate(activities, start=1):
        if p["id"] in chosen:
            continue
        reasons = []
        if theme_tags and p.get("relevance", 0.5) <= 0.3:
            reasons.append(f"Doesn't match your interests ({', '.join(theme_tags)})")
        reasons.append(f"Ranked #{rank}; your days have room for {slots} stops")
        out.append({
            "poiId": None, "key": p["id"], "name": p["name"], "price": _typical_spend(p.get("categories", [])), "priceSource": "estimate",
            "rating": None, "ratingCount": None, "durationMin": estimate_dwell_minutes(p.get("categories", []))["typical"], "tags": [],
            "imageUrl": None, "location": {"lat": p["lat"], "lng": p["lng"]}, "distanceKm": p.get("distanceKm"), "score": p.get("score"),
            "rank": rank, "verdict": "left_out", "reasons": reasons[:3],
        })
        if len(out) >= 12:
            break
    return out
