"""How long a stop takes and what kind of stop it is. Adapted from
trip-planner/backend/app/dwell.py - categories keyed to Geoapify's category
taxonomy (that trip-planner version used Google Places types instead, since
this port's POI source is Geoapify, not Google - see toure's
lib/places/geoapify.ts)."""

FOOD_CATEGORIES = {"catering.restaurant", "catering.cafe", "catering.fast_food", "catering.bar"}

_DWELL_BY_PREFIX = {
    "tourism.sights": (30, 60, 120),
    "tourism.attraction": (45, 90, 150),
    "entertainment": (60, 120, 180),
    "leisure.park": (30, 60, 120),
    "catering.restaurant": (45, 60, 90),
    "catering.cafe": (20, 30, 45),
    "catering.fast_food": (15, 25, 40),
    "catering.bar": (45, 75, 120),
    "accommodation.hotel": (15, 20, 30),
}
_DEFAULT_DWELL = (30, 60, 90)


def is_food_poi(categories: list[str]) -> bool:
    return any(c in FOOD_CATEGORIES for c in categories)


def estimate_dwell_minutes(categories: list[str]) -> dict:
    for cat in categories:
        for prefix, (lo, typical, hi) in _DWELL_BY_PREFIX.items():
            if cat == prefix or cat.startswith(prefix + "."):
                return {"min": lo, "typical": typical, "max": hi}
    lo, typical, hi = _DEFAULT_DWELL
    return {"min": lo, "typical": typical, "max": hi}


# ---------------------------------------------------------------- generic ML attrs for live (non-catalog) places
# Geoapify gives us a name, category and coordinates - no intensity, stairs, hours or ratings the way the curated
# catalog has. These are honest, coarse defaults per category family so the SAME satisfaction/crowd models used for
# catalog destinations can also score any live Geoapify place, instead of every city outside the curated 12 getting
# no per-person fit at all. Less precise than curated data, but a real ML score beats none.
_DEFAULT_ATTRS_BY_PREFIX = {
    # prefix: (intensity, stairs, walk_km, seating, shade, kid_friendly, min_age, indoor_outdoor, best_time)
    "tourism.sights": (2, 0.5, 1.5, 0.3, 0.2, True, 0, "mixed", "morning"),
    "tourism.attraction": (2, 0.4, 1.2, 0.3, 0.3, True, 0, "mixed", "all"),
    "entertainment": (2, 0.2, 0.8, 0.6, 0.4, True, 0, "mixed", "evening"),
    "leisure.park": (1, 0.1, 1.0, 0.4, 0.5, True, 0, "outdoor", "morning"),
    "catering.restaurant": (1, 0.1, 0.2, 0.9, 0.7, True, 0, "indoor", "all"),
    "catering.cafe": (1, 0.1, 0.2, 0.8, 0.6, True, 0, "indoor", "all"),
    "catering.fast_food": (1, 0.1, 0.2, 0.7, 0.6, True, 0, "indoor", "all"),
    "catering.bar": (1, 0.1, 0.3, 0.7, 0.3, False, 18, "indoor", "evening"),
    "commercial": (1, 0.3, 1.0, 0.3, 0.4, True, 0, "mixed", "afternoon"),
}
_DEFAULT_ATTRS = (2, 0.4, 1.0, 0.3, 0.3, True, 0, "mixed", "all")


def default_ml_attrs(categories: list[str]) -> dict:
    """A generic attrs dict, same shape the curated catalog's `attrs` column has, from Geoapify categories alone."""
    for cat in categories or []:
        for prefix, vals in _DEFAULT_ATTRS_BY_PREFIX.items():
            if cat == prefix or cat.startswith(prefix + "."):
                intensity, stairs, walk_km, seating, shade, kid_friendly, min_age, indoor_outdoor, best_time = vals
                return {"category": prefix.split(".")[0], "intensity": intensity, "stairs": stairs, "walkKm": walk_km, "seating": seating,
                        "shade": shade, "popularity": 0.3, "minAge": min_age, "kidFriendly": kid_friendly, "bestTime": best_time,
                        "closedWeekdays": [], "openMin": 540, "openWindowMin": 660, "_indoorOutdoor": indoor_outdoor}
    intensity, stairs, walk_km, seating, shade, kid_friendly, min_age, indoor_outdoor, best_time = _DEFAULT_ATTRS
    return {"category": "sights", "intensity": intensity, "stairs": stairs, "walkKm": walk_km, "seating": seating, "shade": shade,
            "popularity": 0.3, "minAge": min_age, "kidFriendly": kid_friendly, "bestTime": best_time, "closedWeekdays": [],
            "openMin": 540, "openWindowMin": 660, "_indoorOutdoor": indoor_outdoor}
