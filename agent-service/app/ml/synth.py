"""Synthetic training data: simulated travelers visiting REAL places (Kaggle + catalogue), scored by a latent
"true satisfaction" function built from the expert priors in priors.py, plus noise and per-person taste.

This is how the model is bootstrapped before any real ratings exist. Real traveler feedback (reviews, swaps,
skips) is added on top at retrain time with a higher sample weight, so the model drifts toward reality.
"""
import numpy as np

from .features import crowd_row, row
from .priors import (AFFINITY, BEST_TIME_SHIFT, CATS, INTEREST_CATS, MONTH_HEAT, MOOD_EFFECT, MOODS, PROFILE, SEASON, band_of,
                     crowd_curve)

INTERESTS = list(INTEREST_CATS)
AGE_MIX = [((2, 7), 0.14), ((8, 12), 0.12), ((13, 17), 0.10), ((18, 30), 0.23), ((31, 59), 0.26), ((60, 74), 0.11), ((75, 88), 0.04)]


# ---------------------------------------------------------------- crowds
def true_crowd(place: dict, hour: float, weekday: int, month: int, rain: bool, rng=None) -> float:
    pop = min(1.0, np.log1p(place.get("popularity", 0.1) * 100) / np.log1p(300))  # 3 lakh reviews ~ saturated
    shift = BEST_TIME_SHIFT.get((place.get("best_time") or "all").strip().lower(), 0.0) * 0.35
    curve = crowd_curve(place["category"], hour - shift)
    level = (12 + 70 * pop) * curve
    level *= 1.25 if weekday >= 5 else 1.0
    level *= SEASON.get(month, 1.0)
    if rain and place.get("indoor", 0) < 0.5:
        level *= 0.65
    if rng is not None:
        level += rng.normal(0, 5)
    return float(np.clip(level, 0, 100))


def crowd_dataset(places: list, n: int = 60000, seed: int = 11):
    rng = np.random.default_rng(seed)
    X, y, g = [], [], []
    for _ in range(n):
        i = rng.integers(len(places))
        p = places[i]
        hour = rng.uniform(6, 22)
        wd, month, rain = int(rng.integers(7)), int(rng.integers(1, 13)), bool(rng.random() < 0.12)
        X.append(crowd_row(p, hour, wd, month, rain))
        y.append(true_crowd(p, hour, wd, month, rain, rng))
        g.append(i)
    return np.asarray(X, np.float32), np.asarray(y, np.float32), np.asarray(g)


# ---------------------------------------------------------------- people
def sample_person(rng) -> dict:
    (lo, hi) = AGE_MIX[rng.choice(len(AGE_MIX), p=[w for _, w in AGE_MIX])][0]
    age = int(rng.integers(lo, hi + 1))
    band = band_of(age)
    aff = dict(zip(CATS, AFFINITY[band]))
    # people tend to pick interests that match what their life stage enjoys
    weights = np.array([max(0.05, 0.4 + np.mean([aff[c] for c in INTEREST_CATS[i]])) for i in INTERESTS])
    k = int(rng.integers(0, 4))
    interests = list(rng.choice(INTERESTS, size=k, replace=False, p=weights / weights.sum())) if k else []
    step_free = rng.random() < (0.5 if age >= 75 else 0.22 if age >= 60 else 0.02)
    return {"age": age, "interests": interests, "step_free": step_free, "bias": rng.normal(0, 0.2)}


def sample_moods(rng) -> list:
    k = rng.choice([0, 1, 2], p=[0.45, 0.4, 0.15])
    return list(rng.choice(MOODS, size=k, replace=False)) if k else []


def true_satisfaction(person: dict, place: dict, ctx: dict, rng=None) -> float:
    age = person["age"]
    band = band_of(age)
    p = dict(PROFILE[band])
    cat = place["category"]
    aff = dict(zip(CATS, AFFINITY[band]))[cat]
    for m in ctx.get("moods", []):
        eff = MOOD_EFFECT[m]
        if eff.get("kids_only") and age > 12:
            continue
        if eff.get("adults_only") and age < 18:
            continue
        aff += eff.get("cats", {}).get(cat, 0.0)
        p["energy"] += eff.get("energy", 0.0)
        p["duration"] += eff.get("duration", 0.0)
        p["walk"] = max(0.5, p["walk"] + eff.get("walk", 0.0))
        p["crowd"] = max(0.05, p["crowd"] + eff.get("crowd", 0.0))
        p["heat"] = max(0.05, p["heat"] + eff.get("heat", 0.0))
    ints = person.get("interests") or ctx.get("group_interests") or []
    match = min(3, len(set(ints) & set(place.get("tags", [])) | {i for i in ints if cat in INTEREST_CATS.get(i, [])}))
    start_h = ctx["start_min"] / 60
    end_h = start_h + place["duration_min"] / 60
    from .features import midday_overlap
    heat = (1 - place["indoor"]) * (1 - place["shade"]) * MONTH_HEAT.get(ctx.get("month", 11), 0.4) * midday_overlap(start_h, end_h)

    u = 3.35 + 1.0 * (place["rating"] - 4.3) + 0.95 * aff + 0.32 * match
    u -= 0.55 * max(0.0, place["intensity"] - p["energy"])
    u -= 1.2 * place["stairs"] * (1 - p["stairs"]) * (1.8 if person.get("step_free") else 1.0)
    u -= 0.25 * max(0.0, place["walk_km"] - p["walk"])
    u -= 1.3 * heat * (1 - p["heat"])
    u -= 1.1 * (ctx.get("crowd", 40) / 100) * (1 - p["crowd"])
    u -= 0.35 * max(0.0, place["duration_min"] - p["duration"]) / 60
    u -= 0.6 * max(0.0, end_h - p["late"])
    if band in ("senior", "elder"):
        u += 0.35 * place["seating"]
    if band in ("young_child", "child"):
        u += 0.25 if place.get("kid_friendly", True) else -0.7
    u -= 0.9 * (1 - place["indoor"]) * float(bool(ctx.get("rain")))
    if rng is not None:
        u += rng.normal(0, 0.3) + person.get("bias", 0.0)
    if age < place.get("min_age", 0):
        u = 1.0 + (abs(rng.normal(0, 0.15)) if rng is not None else 0.0)
    return float(np.clip(u, 1.0, 5.0))


def satisfaction_dataset(places: list, n: int = 80000, seed: int = 7):
    rng = np.random.default_rng(seed)
    X, y, g = [], [], []
    for _ in range(n):
        i = int(rng.integers(len(places)))
        place = places[i]
        person = sample_person(rng)
        month, wd, rain = int(rng.integers(1, 13)), int(rng.integers(7)), bool(rng.random() < 0.1)
        start = int(rng.uniform(7 * 60, 20 * 60))
        crowd = true_crowd(place, start / 60 + place["duration_min"] / 120, wd, month, rain, rng)
        ctx = {"start_min": start, "month": month, "rain": rain, "crowd": crowd, "moods": sample_moods(rng),
               "group_interests": list(rng.choice(INTERESTS, size=2, replace=False)) if rng.random() < 0.5 else []}
        X.append(row(person, place, ctx))
        y.append(true_satisfaction(person, place, ctx, rng))
        g.append(i)
    return np.asarray(X, np.float32), np.asarray(y, np.float32), np.asarray(g)
