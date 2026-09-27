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
