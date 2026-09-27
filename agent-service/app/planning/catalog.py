"""Curated-catalog candidates and the "why was this left out" record.

The catalog (Mongo `pois`, filled by scripts/seed-catalog.mjs) has what live Geoapify results
lack: real prices, ratings, opening hours and kid/step-free flags. When the destination is in
the catalog the planner chooses from it; either way every candidate that did NOT make the plan is
kept, with a price and plain-language reasons, so the traveller can see what was passed over and
why (and swap it in).

Pure functions, no I/O, so the reasons are easy to test.
"""

from datetime import date, timedelta

from .geo import haversine_km

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

# A place is far from the plan's centre of gravity beyond this.
FAR_KM = 8.0
MAX_REASONS = 3
MAX_CONSIDERED = 12


def to_place(p: dict) -> dict:
    """Catalog POI -> the place dict the sequencer already understands, plus the extra keys the
    cards and the explanation need."""
    attrs = p.get("attrs") or {}
    return {
        "id": p["poiId"],
        "poiId": p.get("id"),
        "name": p["name"],
        "lat": p["lat"],
        "lng": p["lng"],
        # Not a restaurant, so never treated as a meal slot; dwell and spend come from the catalog.
        "categories": ["tourism.attraction"],
        "activityType": p.get("category") or "activity",
        "dwellMin": p.get("durationMin") or 60,
        "spend": p.get("price") or 0,
        "price": p.get("price") or 0,
        "rating": p.get("rating") or 0,
        "ratingCount": p.get("ratingCount") or 0,
        "tags": p.get("tags") or [],
        "description": p.get("description") or "",
        "imageUrl": p.get("imageUrl"),
        "indoorOutdoor": p.get("indoorOutdoor"),
        "stepFree": bool(p.get("stepFree")),
        "kidFriendly": bool(attrs.get("kidFriendly", True)),
        "closedWeekdays": attrs.get("closedWeekdays") or [],
        "minAge": attrs.get("minAge") or 0,
        "prefHour": _pref_hour(attrs),
        "openMin": attrs.get("openMin") or 0,
        "closeMin": (attrs.get("openMin") or 0) + (attrs.get("openWindowMin") or 24 * 60),
        "address": None,
        "ml": _ml_place(p, attrs),
    }


_IO = {"indoor": 1.0, "mixed": 0.5, "outdoor": 0.0}


def _ml_place(p: dict, attrs: dict) -> dict:
    """The place as the satisfaction/crowd models expect it (see app/ml/features.py)."""
    return {
        "id": p["poiId"], "category": attrs.get("category") or p.get("category") or "heritage", "tags": p.get("tags") or [],
        "intensity": attrs.get("intensity", 2), "stairs": attrs.get("stairs", 0.3), "walk_km": attrs.get("walkKm", 1.5),
        "seating": attrs.get("seating", 0.3), "shade": attrs.get("shade", 0.3), "indoor": _IO.get(p.get("indoorOutdoor"), 0.5),
        "duration_min": p.get("durationMin") or 90, "rating": p.get("rating") or 4.3, "popularity": attrs.get("popularity", 0.1),
        "kid_friendly": bool(attrs.get("kidFriendly", True)), "min_age": attrs.get("minAge") or 0, "price": p.get("price") or 0,
        "best_time": attrs.get("bestTime") or "all",
    }


def _pref_hour(attrs: dict) -> float:
    """When in the day this stop works best: sunrise walks early, sunsets late, never before it opens."""
    best = {"morning": 9.0, "afternoon": 13.0, "evening": 16.5}.get(attrs.get("bestTime") or "all", 11.0)
    open_h = (attrs.get("openMin") or 0) / 60
    return max(best, open_h)


def trip_weekdays(start_date: str, num_days: int) -> list[int]:
    start = date.fromisoformat(start_date[:10])
    return [(start + timedelta(days=i)).weekday() for i in range(num_days)]


def excluded_reason(p: dict, *, group_type: str, budget: float, weekdays: list[int]) -> str | None:
    """A hard 'this cannot go in the plan' reason, or None if it is eligible."""
    closed = set(p.get("closedWeekdays") or [])
    if closed and all(w in closed for w in set(weekdays)):
        names = ", ".join(WEEKDAYS[w].capitalize() for w in sorted(closed))
        return f"Closed on {names}, which covers every day of your trip"
    if group_type == "family" and not p.get("kidFriendly", True):
        return "Not suited to children" + (f" (minimum age {p['minAge']})" if p.get("minAge") else "")
    if budget and p.get("price", 0) > 0.4 * budget:
        return f"At Rs. {round(p['price']):,} per person it would take over 40% of your Rs. {round(budget):,} budget"
    return None


def score_catalog_place(p: dict, theme_tags: list[str], center: dict, fit: dict | None = None) -> dict:
    """`fit` is fit.evaluate(...) for this place. With it, the models' group fit is a quarter of the score;
    without it (no traveller details) the score is interests, quality and distance only."""
    distance_km = haversine_km(center["lat"], center["lng"], p["lat"], p["lng"])
    distance_score = max(0.0, 1.0 - distance_km / 15.0)
    hits = len(set(p["tags"]) & set(theme_tags))
    relevance = 0.5 if not theme_tags else min(1.0, 0.25 + 0.4 * hits)
    quality = max(0.0, min(1.0, (p["rating"] - 3.5) / 1.5)) * 0.7 + min(1.0, p["ratingCount"] / 800) * 0.3
    if fit:
        score = relevance * 0.35 + quality * 0.2 + distance_score * 0.15 + fit["group"] / 100 * 0.3
        extra = {"memberFits": fit["members"], "groupFit": fit["group"], "crowd": fit["crowd"]}
    else:
        score = relevance * 0.5 + quality * 0.3 + distance_score * 0.2
        extra = {}
    return {**p, **extra, "score": round(score, 4), "relevance": relevance, "themeHits": hits, "distanceKm": round(distance_km, 1), "is_food": False}


def fit_reason(p: dict, theme_tags: list[str]) -> str:
    matched = [t for t in p.get("tags", []) if t in theme_tags]
    bits = []
    if matched:
        bits.append("Matches your " + " and ".join(matched[:2]) + " interest" + ("s" if len(matched) > 1 else ""))
    if p.get("rating"):
        bits.append(f"{p['rating']:.1f} rating" + (f" from {p['ratingCount']:,} reviews" if p.get("ratingCount") else ""))
    return " · ".join(bits) or "A well-rated stop near the rest of your day"


def explain_left_out(p: dict, *, rank: int, slots: int, theme_tags: list[str], selected: list[dict]) -> list[str]:
    """Why an eligible candidate was not chosen, most decisive reason first."""
    reasons: list[str] = []
    if theme_tags and p.get("themeHits", 0) == 0:
        reasons.append(f"Doesn't match your interests ({', '.join(theme_tags)})")
    if p.get("distanceKm", 0) > FAR_KM:
        reasons.append(f"{p['distanceKm']:.0f} km from the centre, farther than your other stops")
    picked_ratings = [s["rating"] for s in selected if s.get("rating")]
    if p.get("rating") and picked_ratings:
        avg = sum(picked_ratings) / len(picked_ratings)
        if p["rating"] < avg - 0.3:
            reasons.append(f"Rated {p['rating']:.1f}, below the {avg:.1f} average of your picks")
    twin = next((s for s in selected if s.get("activityType") == p.get("activityType") and haversine_km(s["lat"], s["lng"], p["lat"], p["lng"]) < 1.2), None)
    if twin:
        reasons.append(f"Close to and similar to {twin['name']}, which is already in your plan")
    group = p.get("groupFit")
    picked_fits = [x["groupFit"] for x in selected if x.get("groupFit") is not None]
    if group is not None and picked_fits:
        avg = round(sum(picked_fits) / len(picked_fits))
        if avg - group >= 8:
            weakest = min((m for m in p.get("memberFits", []) if not m.get("veto")), key=lambda m: m["fit"], default=None)
            held = f"; weakest for {weakest['name']} ({weakest['fit']}%)" + (f", {weakest['reasons'][0]}" if weakest.get("reasons") else "") if weakest else ""
            reasons.insert(0, f"Lower group fit: {group}% vs {avg}% average for your picks{held}")
    if len(reasons) < MAX_REASONS:
        reasons.append(f"Ranked #{rank}; your days have room for {slots} stops")
    return reasons[:MAX_REASONS]


def build_considered(scored: list[dict], selected: list[dict], excluded: list[tuple[dict, str]], *, slots: int, theme_tags: list[str]) -> list[dict]:
    """The traveller-facing 'left out, and why' list: near-misses first, then hard exclusions."""
    chosen = {p["id"] for p in selected}
    out: list[dict] = []
    for rank, p in enumerate(scored, start=1):
        if p["id"] in chosen:
            continue
        out.append(_entry(p, rank, explain_left_out(p, rank=rank, slots=slots, theme_tags=theme_tags, selected=selected), "left_out"))
    for p, why in excluded:
        out.append(_entry(p, None, [why], "excluded"))
    return out[:MAX_CONSIDERED]


def _entry(p: dict, rank: int | None, reasons: list[str], verdict: str) -> dict:
    return {
        "poiId": p.get("poiId"),
        "key": p["id"],
        "name": p["name"],
        "price": round(p.get("price", 0)),
        "priceSource": "catalog" if p.get("rating") else "estimate",
        "rating": p.get("rating") or None,
        "ratingCount": p.get("ratingCount") or None,
        "durationMin": p.get("dwellMin"),
        "tags": p.get("tags", []),
        "imageUrl": p.get("imageUrl"),
        "location": {"lat": p["lat"], "lng": p["lng"]},
        "distanceKm": p.get("distanceKm"),
        "score": p.get("score"),
        "memberFits": p.get("memberFits"),
        "groupFit": p.get("groupFit"),
        "crowd": p.get("crowd"),
        "rank": rank,
        "verdict": verdict,
        "reasons": reasons,
    }


def live_to_place(p: dict, dwell_min: int, spend: int) -> dict:
    """A live (Geoapify) candidate, in the same shape to_place() produces for a curated place, using
    dwell.default_ml_attrs() for everything the catalog would normally supply. Lets the SAME satisfaction/crowd
    models, and the SAME disruption/mood engines, run on any destination - not only the curated 12 cities."""
    from hashlib import md5

    from .dwell import default_ml_attrs

    attrs = default_ml_attrs(p.get("categories") or [])
    poi_id = "live_" + md5(f"{p.get('name')}{p['lat']:.4f}{p['lng']:.4f}".encode()).hexdigest()[:12]
    return {
        "id": poi_id, "poiId": poi_id, "name": p.get("name") or "Stop", "lat": p["lat"], "lng": p["lng"],
        "categories": p.get("categories") or [], "activityType": attrs["category"], "dwellMin": dwell_min,
        "spend": spend, "price": spend, "rating": 0, "ratingCount": 0, "tags": [], "description": "",
        "imageUrl": None, "indoorOutdoor": attrs.pop("_indoorOutdoor"), "stepFree": attrs["stairs"] < 0.4,
        "kidFriendly": attrs["kidFriendly"], "closedWeekdays": [], "minAge": attrs["minAge"],
        "prefHour": {"morning": 9.0, "afternoon": 13.0, "evening": 17.0}.get(attrs["bestTime"], 11.0),
        "openMin": attrs["openMin"], "closeMin": attrs["openMin"] + attrs["openWindowMin"], "address": p.get("address"),
        "ml": {"id": poi_id, **attrs, "duration_min": dwell_min, "price": spend},
    }
