"""Runtime access to the trained models: per-person fit with explanations, crowd forecasts, mood parsing.
Models load lazily from app/ml/models; if they're missing or unreadable they are trained on the spot."""
import os
import threading
from datetime import date

import joblib
import numpy as np

from .features import EXPLAIN, IDX, crowd_row, row
from .priors import BAND_LABEL, band_of
from .train import MODEL_DIR, MOOD_THRESHOLD, read_metrics, train

_lock = threading.Lock()
_M: dict = {}
_cache: dict = {}


def _load():
    try:
        _M["sat"] = joblib.load(os.path.join(MODEL_DIR, "satisfaction.joblib"))
        _M["crowd"] = joblib.load(os.path.join(MODEL_DIR, "crowd.joblib"))
        _M["mood"] = joblib.load(os.path.join(MODEL_DIR, "mood.joblib"))
        _M["meta"] = read_metrics() or {}
    except Exception:
        train(verbose=False)
        _load()


def models() -> dict:
    if not _M:
        with _lock:
            if not _M:
                _load()
    return _M


def reload():
    with _lock:
        _M.clear()
        _cache.clear()
    models()


def version() -> int:
    return models()["meta"].get("version", 0)


# ---------------------------------------------------------------- satisfaction
def predict_rows(rows: list) -> np.ndarray:
    if not rows:
        return np.zeros(0)
    return np.clip(models()["sat"].predict(np.asarray(rows, np.float32)), 1.0, 5.0)


def to_fit(score: float) -> int:
    return int(round((score - 1) / 4 * 100))


def veto(member: dict, place: dict) -> str | None:
    """Hard safety/access rules — never left to a model."""
    age = member.get("age", 35)
    if age < (place.get("min_age") or 0):
        return f"minimum age {int(place['min_age'])}"
    if member.get("step_free") and place.get("stairs", 0) >= 0.6:
        return "too many stairs (needs step-free)"
    if age <= 7 and not place.get("kid_friendly", True):
        return "not suitable for young children"
    return None


def _key(member, place, ctx):
    return (place.get("id"), place.get("rating"), member.get("age"), bool(member.get("step_free")), tuple(sorted(member.get("interests") or [])),
            int(ctx.get("start_min", 600)) // 15, ctx.get("month"), int(ctx.get("crowd", 40)) // 5, bool(ctx.get("rain")),
            tuple(sorted(ctx.get("moods") or [])), tuple(sorted(ctx.get("group_interests") or [])))


def scores(pairs: list) -> list:
    """pairs: [(member, place, ctx)] -> predicted 1-5 score per pair (cached, batched)."""
    out, todo, rows = [None] * len(pairs), [], []
    for i, (m, p, c) in enumerate(pairs):
        k = _key(m, p, c)
        if k in _cache:
            out[i] = _cache[k]
        else:
            todo.append((i, k))
            rows.append(row(m, p, c))
    if rows:
        pred = predict_rows(rows)
        for (i, k), v in zip(todo, pred):
            _cache[k] = out[i] = float(v)
        if len(_cache) > 200000:
            _cache.clear()
    return out


def explain(member: dict, place: dict, ctx: dict) -> tuple[list, str | None]:
    """Which factors pull this person's score down (removing them helps most), and one positive reason."""
    base = row(member, place, ctx)
    variants = []
    for key, (_, changes) in EXPLAIN.items():
        v = list(base)
        for f, val in changes.items():
            v[IDX[f]] = val
        variants.append(v)
    preds = predict_rows([base] + variants)
    b = preds[0]
    neg = sorted([(preds[i + 1] - b, key) for i, key in enumerate(EXPLAIN)], reverse=True)
    reasons = [EXPLAIN[k][0] for d, k in neg if d > 0.2][:2]
    pos = None
    if base[IDX["interest_match"]] >= 1:
        pos = "matches their interests"
    elif b >= 4.2:
        pos = f"great for a {BAND_LABEL[band_of(member.get('age', 35))].lower()}"
    return reasons, pos


def member_fits(members: list, place: dict, ctx: dict, with_reasons=False) -> list:
    sc = scores([(m, place, ctx) for m in members])
    out = []
    for m, s in zip(members, sc):
        v = veto(m, place)
        d = {"name": m.get("name"), "age": m.get("age"), "band": BAND_LABEL[band_of(m.get("age", 35))],
             "score": round(1.0 if v else s, 2), "fit": 0 if v else to_fit(s), "veto": v}
        if with_reasons and not v:
            d["reasons"], d["positive"] = explain(m, place, ctx)
        out.append(d)
    return out


def group_fit(member_results: list, weights: dict | None = None) -> int:
    """Fairness: 60% weighted average + 40% of the least-happy member, so nobody gets left behind."""
    if not member_results:
        return 0
    fits = [(r["fit"], (weights or {}).get(r["name"], 1.0)) for r in member_results]
    avg = sum(f * w for f, w in fits) / sum(w for _, w in fits)
    return int(round(0.6 * avg + 0.4 * min(f for f, _ in fits)))


# ---------------------------------------------------------------- crowds
def crowd(place: dict, on: date, hour: float, rain: bool = False) -> int:
    k = ("crowd", place.get("id"), on.weekday(), on.month, round(hour * 2) / 2, rain)
    if k not in _cache:
        _cache[k] = int(np.clip(models()["crowd"].predict(np.asarray([crowd_row(place, hour, on.weekday(), on.month, rain)], np.float32))[0], 0, 100))
    return _cache[k]


def crowd_curve(place: dict, on: date, rain: bool = False, hours=range(6, 22)) -> list:
    rows = [crowd_row(place, h + 0.5, on.weekday(), on.month, rain) for h in hours]
    pred = np.clip(models()["crowd"].predict(np.asarray(rows, np.float32)), 0, 100)
    return [{"hour": h, "crowd": int(v)} for h, v in zip(hours, pred)]


# ---------------------------------------------------------------- moods
def parse_mood(text: str) -> list:
    if not text or not text.strip():
        return []
    m = models()["mood"]
    probs = m["pipe"].predict_proba([text])[0]
    return [{"mood": lab, "p": round(float(p), 2)} for lab, p in sorted(zip(m["labels"], probs), key=lambda x: -x[1]) if p >= MOOD_THRESHOLD]
