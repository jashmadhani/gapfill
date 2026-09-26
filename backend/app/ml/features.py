"""Feature construction shared by training and inference, so the model always sees the same columns."""
import math

import numpy as np

from .priors import CATS, INTEREST_CATS, MONTH_HEAT, MOODS

IO = {"indoor": 1.0, "mixed": 0.5, "outdoor": 0.0}

FEATURES = (
    ["age", "needs_step_free", "interest_match"]
    + [f"cat_{c}" for c in CATS]
    + ["intensity", "stairs", "walk_km", "seating", "shade", "indoor", "duration_h", "rating", "log_popularity",
       "kid_friendly", "min_age", "under_min_age", "log_price"]
    + ["start_hour", "end_hour", "month_heat", "heat_exposure", "crowd", "rain_outdoor"]
    + [f"mood_{m}" for m in MOODS]
)
IDX = {f: i for i, f in enumerate(FEATURES)}

# interpretable groups used to explain a prediction: set to a neutral value and see how much the score moves
EXPLAIN = {
    "stairs": ("lots of stairs", {"stairs": 0.0}),
    "effort": ("physically demanding", {"intensity": 1.0, "walk_km": 0.6}),
    "crowds": ("very crowded at that hour", {"crowd": 15.0}),
    "heat": ("midday heat, little shade", {"heat_exposure": 0.0}),
    "late": ("runs late for them", {"end_hour": 17.0}),
    "length": ("long for their attention span", {"duration_h": 1.0}),
    "rain": ("outdoors in the rain", {"rain_outdoor": 0.0}),
}


def interest_match(person_interests, place_tags, category) -> int:
    ints = set(person_interests or [])
    hits = ints & set(place_tags or [])
    hits |= {i for i in ints if category in INTEREST_CATS.get(i, [])}
    return min(3, len(hits))


def midday_overlap(start_h: float, end_h: float) -> float:
    """Fraction of the visit that falls in the 12:00-16:00 heat window."""
    if end_h <= start_h:
        return 0.0
    ov = max(0.0, min(end_h, 16.0) - max(start_h, 12.0))
    return ov / (end_h - start_h)


def row(person: dict, place: dict, ctx: dict) -> list:
    age = float(person.get("age", 35))
    cat = place.get("category", "heritage")
    start_h = ctx.get("start_min", 600) / 60
    end_h = start_h + place.get("duration_min", 90) / 60
    indoor = place.get("indoor", 0.0)
    month_heat = MONTH_HEAT.get(int(ctx.get("month", 11)), 0.4)
    heat = (1 - indoor) * (1 - place.get("shade", 0.3)) * month_heat * midday_overlap(start_h, end_h)
    min_age = float(place.get("min_age", 0))
    moods = set(ctx.get("moods") or [])
    ints = person.get("interests") or ctx.get("group_interests") or []
    return (
        [age, float(bool(person.get("step_free"))), float(interest_match(ints, place.get("tags"), cat))]
        + [1.0 if cat == c else 0.0 for c in CATS]
        + [float(place.get("intensity", 2)), float(place.get("stairs", 0.3)), float(place.get("walk_km", 1.5)),
           float(place.get("seating", 0.3)), float(place.get("shade", 0.3)), float(indoor), place.get("duration_min", 90) / 60,
           float(place.get("rating", 4.3)), math.log1p(float(place.get("popularity", 0.1)) * 100),
           float(bool(place.get("kid_friendly", True))), min_age, float(age < min_age), math.log1p(float(place.get("price", 0)))]
        + [start_h, end_h, month_heat, heat, float(ctx.get("crowd", 40)), (1 - indoor) * float(bool(ctx.get("rain")))]
        + [1.0 if m in moods else 0.0 for m in MOODS]
    )


def matrix(rows: list) -> np.ndarray:
    return np.asarray(rows, dtype=np.float32)


CROWD_FEATURES = ([f"cat_{c}" for c in CATS]
                  + ["log_popularity", "rating", "hour", "weekday", "is_weekend", "month", "rain_outdoor", "indoor"]
                  + [f"best_{b}" for b in ("morning", "afternoon", "evening", "all")])


def crowd_row(place: dict, hour: float, weekday: int, month: int, rain: bool) -> list:
    cat = place.get("category", "heritage")
    best = (place.get("best_time") or "all").strip().lower()
    best = best if best in ("morning", "afternoon", "evening") else "all"
    indoor = place.get("indoor", 0.0)
    return ([1.0 if cat == c else 0.0 for c in CATS]
            + [math.log1p(float(place.get("popularity", 0.1)) * 100), float(place.get("rating", 4.3)), float(hour), float(weekday),
               float(weekday >= 5), float(month), (1 - indoor) * float(bool(rain)), float(indoor)]
            + [1.0 if best == b else 0.0 for b in ("morning", "afternoon", "evening", "all")])
