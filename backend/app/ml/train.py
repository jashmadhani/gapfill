"""Train the three TourCraft models and write them + an evaluation report to app/ml/models/.

    python -m app.ml.train            # from backend/

1. Satisfaction model — predicts how much ONE traveler (age, interests, needs, mood) will enjoy ONE place at a given
   time (crowds, heat, rain). HistGradientBoostingRegressor. The planner combines per-person predictions fairly.
2. Crowd model — predicts busyness 0-100 for a place by hour / weekday / month / weather.
3. Mood model — reads free text ("the kids are cranky and it's boiling") into mood labels. TF-IDF + logistic regression.

Evaluation holds out whole PLACES (not rows), so scores reflect places the model has never seen.
"""
import json
import os
import time
from datetime import datetime, timezone

import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import f1_score, mean_absolute_error, r2_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.multiclass import OneVsRestClassifier
from sklearn.pipeline import FeatureUnion, make_pipeline
from sklearn.preprocessing import MultiLabelBinarizer

from . import mood_data
from .data import kaggle_lookup, kaggle_places
from .features import FEATURES, IDX, IO, row
from .priors import BAND_LABEL, CAT_TAGS, CATS, MOODS
from .synth import crowd_dataset, satisfaction_dataset

HERE = os.path.dirname(__file__)
MODEL_DIR = os.path.join(HERE, "models")
MOOD_THRESHOLD = 0.5
N_SAT, N_CROWD = 120000, 60000


def catalog_places() -> list:
    from ..catalog import ACTIVITIES, ATTRS
    kl = kaggle_lookup()
    out = []
    for (dest, title, tags, dur, price, op, cl, io, rating, cnt, kids, step, closed, vname, desc) in ACTIVITIES:
        cat, inten, stairs, walk, seat, shade, min_age, pop, best, kref = ATTRS[title]
        if kref and kref in kl:
            pop = kl[kref]["reviews_lakh"]
        out.append({"id": f"c:{title}", "title": title, "category": cat, "intensity": inten, "stairs": stairs, "walk_km": walk,
                    "seating": seat, "shade": shade, "indoor": IO[io], "duration_min": dur, "rating": rating, "popularity": pop,
                    "kid_friendly": kids, "min_age": min_age, "price": price, "tags": tags, "best_time": best})
    return out


def place_pool() -> list:
    return kaggle_places() + catalog_places()


def _group(name: str) -> str:
    if name.startswith("cat_"):
        return "Kind of place"
    if name.startswith("mood_"):
        return "Mood"
    return {"age": "Age", "needs_step_free": "Step-free need", "interest_match": "Interest match", "intensity": "Physical effort",
            "stairs": "Stairs", "walk_km": "Walking", "seating": "Seating", "shade": "Shade", "indoor": "Indoor / outdoor",
            "duration_h": "Duration", "rating": "Place rating", "log_popularity": "Popularity", "kid_friendly": "Kid friendly",
            "min_age": "Minimum age", "under_min_age": "Below minimum age", "log_price": "Price", "start_hour": "Time of day",
            "end_hour": "Finish time", "month_heat": "Season heat", "heat_exposure": "Heat exposure", "crowd": "Crowds",
            "rain_outdoor": "Rain"}.get(name, name)


# ---------------------------------------------------------------- behavioural tests (sanity expectations written by hand)
def _canon(cat, **kw):
    base = {"category": cat, "intensity": 2, "stairs": 0.3, "walk_km": 1.5, "seating": 0.4, "shade": 0.4, "indoor": 0.0,
            "duration_min": 120, "rating": 4.5, "popularity": 0.3, "kid_friendly": True, "min_age": 0, "price": 500,
            "tags": CAT_TAGS[cat], "best_time": "all"}
    base.update(kw)
    return base


def behaviour_tests(model) -> list:
    def p(age, place, start=10 * 60, month=11, crowd=35, moods=(), rain=False, step_free=False, interests=()):
        x = row({"age": age, "interests": list(interests), "step_free": step_free}, place,
                {"start_min": start, "month": month, "crowd": crowd, "moods": list(moods), "rain": rain})
        return float(model.predict(np.asarray([x], np.float32))[0])
    zipline = _canon("adventure", intensity=4, stairs=0.6, min_age=10, kid_friendly=False)
    fort = _canon("heritage", intensity=3, stairs=0.85, walk_km=2.5)
    safari = _canon("wildlife", seating=0.8, walk_km=0.2)
    museum = _canon("museum", indoor=1.0, shade=1.0, seating=0.6, stairs=0.1)
    show = _canon("performance", indoor=1.0, seating=1.0, duration_min=75)
    tests = [
        ("A 20-year-old enjoys a zipline more than a 68-year-old", p(20, zipline) > p(68, zipline) + 0.8),
        ("A 5-year-old scores a zipline (min age 10) near the floor", p(5, zipline) < 1.8),
        ("A 5-year-old enjoys a tiger safari more than a museum", p(5, safari) > p(5, museum) + 0.5),
        ("Stairs-heavy fort: 70-year-old needing step-free scores lower than a 40-year-old", p(70, fort, step_free=True) < p(40, fort) - 0.6),
        ("Midday May heat hurts a senior outdoors more than a January morning", p(70, fort, start=13 * 60, month=5) < p(70, fort, start=9 * 60, month=1) - 0.25),
        ("'Tired' mood lowers an intense fort for adults", p(35, fort, moods=["tired"]) < p(35, fort) - 0.1),
        ("'Hot' mood favours an indoor museum over an exposed fort at noon", p(35, museum, start=12 * 60, month=5, moods=["hot"]) > p(35, fort, start=12 * 60, month=5, moods=["hot"])),
        ("Rain hurts outdoor places, not indoor ones", (p(35, fort) - p(35, fort, rain=True)) > (p(35, museum) - p(35, museum, rain=True)) + 0.4),
        ("A late show (ends ~10:30pm) suits a 25-year-old more than a 6-year-old", p(25, show, start=21 * 60) > p(6, show, start=21 * 60) + 0.5),
        ("Heavy crowds lower the score", p(35, fort, crowd=95) < p(35, fort, crowd=15) - 0.3),
        ("Matching interests raise the score", p(35, museum, interests=["heritage"]) > p(35, museum) + 0.15),
    ]
    return [{"test": t, "passed": bool(ok)} for t, ok in tests]


def learned_matrix(model) -> dict:
    ages = [("young_child", 5), ("child", 10), ("teen", 15), ("young_adult", 24), ("adult", 45), ("senior", 67), ("elder", 80)]
    canon = {"heritage": _canon("heritage", intensity=3, stairs=0.7, walk_km=2.5), "museum": _canon("museum", indoor=1.0, shade=1.0, seating=0.6),
             "religious": _canon("religious", stairs=0.5), "nature": _canon("nature", intensity=1, stairs=0.1),
             "wildlife": _canon("wildlife", seating=0.8, walk_km=0.2), "adventure": _canon("adventure", intensity=4, stairs=0.5),
             "food": _canon("food", seating=0.4), "shopping": _canon("shopping", walk_km=2.0), "performance": _canon("performance", indoor=1.0, seating=1.0),
             "workshop": _canon("workshop", indoor=1.0, seating=0.9, shade=1.0, intensity=1), "relaxation": _canon("relaxation", intensity=1, seating=1.0),
             "viewpoint": _canon("viewpoint", stairs=0.4)}
    rows = [row({"age": a, "interests": []}, canon[c], {"start_min": 10 * 60, "month": 11, "crowd": 35}) for _, a in ages for c in CATS]
    pred = model.predict(np.asarray(rows, np.float32)).reshape(len(ages), len(CATS))
    return {"bands": [{"key": k, "label": BAND_LABEL[k], "age": a} for k, a in ages], "categories": CATS,
            "fit": [[round((v - 1) / 4 * 100) for v in r] for r in pred]}


# ---------------------------------------------------------------- training
def train_satisfaction(places, feedback=None, seed=7):
    X, y, g = satisfaction_dataset(places, N_SAT, seed)
    tr, te = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=seed).split(X, y, g))
    Xtr, ytr, w = X[tr], y[tr], np.ones(len(tr), np.float32)
    n_fb = 0
    if feedback:
        fx = np.asarray([f for f, _ in feedback], np.float32)
        fy = np.asarray([r for _, r in feedback], np.float32)
        Xtr, ytr = np.vstack([Xtr, fx]), np.concatenate([ytr, fy])
        w = np.concatenate([w, np.full(len(fy), 5.0, np.float32)])  # real ratings count 5x a synthetic row
        n_fb = len(fy)
    model = HistGradientBoostingRegressor(max_iter=700, learning_rate=0.06, max_leaf_nodes=63, min_samples_leaf=30,
                                          l2_regularization=0.1, random_state=seed)
    model.fit(Xtr, ytr, sample_weight=w)
    pred = model.predict(X[te])
    base_mean = np.full(len(te), ytr.mean())
    lin = LinearRegression().fit(Xtr[:, [IDX["rating"]]], ytr)
    base_rating = lin.predict(X[te][:, [IDX["rating"]]])
    sub = np.random.default_rng(seed).choice(len(te), size=min(2500, len(te)), replace=False)
    imp = permutation_importance(model, X[te][sub], y[te][sub], n_repeats=2, random_state=seed, scoring="neg_mean_absolute_error")
    grouped: dict = {}
    for name, v in zip(FEATURES, imp.importances_mean):
        grouped[_group(name)] = grouped.get(_group(name), 0.0) + max(0.0, float(v))
    metrics = {
        "rows_synthetic": int(len(X)), "rows_feedback": n_fb, "places": len(places), "test_places": int(len(set(g[te]))),
        "mae": round(float(mean_absolute_error(y[te], pred)), 3), "r2": round(float(r2_score(y[te], pred)), 3),
        "baseline_mean_mae": round(float(mean_absolute_error(y[te], base_mean)), 3),
        "baseline_rating_only_mae": round(float(mean_absolute_error(y[te], base_rating)), 3),
        "importance": sorted([{"feature": k, "value": round(v, 4)} for k, v in grouped.items()], key=lambda d: -d["value"]),
        "tests": behaviour_tests(model), "learned": learned_matrix(model),
    }
    return model, metrics


def train_crowd(places, seed=11):
    X, y, g = crowd_dataset(places, N_CROWD, seed)
    tr, te = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=seed).split(X, y, g))
    model = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.08, max_leaf_nodes=31, random_state=seed)
    model.fit(X[tr], y[tr])
    pred = model.predict(X[te])
    return model, {"rows": int(len(X)), "mae": round(float(mean_absolute_error(y[te], pred)), 2),
                   "r2": round(float(r2_score(y[te], pred)), 3),
                   "baseline_mean_mae": round(float(mean_absolute_error(y[te], np.full(len(te), y[tr].mean()))), 2)}


def train_mood(seed=3):
    X, Y = mood_data.corpus(6000, seed)
    mlb = MultiLabelBinarizer(classes=MOODS)
    Yb = mlb.fit_transform(Y)
    split = int(len(X) * 0.8)
    vec = FeatureUnion([("w", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=1)),
                        ("c", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True, min_df=2))])
    clf = make_pipeline(vec, OneVsRestClassifier(LogisticRegression(C=8, max_iter=2000, class_weight="balanced")))
    clf.fit(X[:split], Yb[:split])
    held = clf.predict(X[split:])
    nat_X = [t for t, _ in mood_data.NATURAL_TEST]
    nat_Y = mlb.transform([y for _, y in mood_data.NATURAL_TEST])
    nat_pred = (clf.predict_proba(nat_X) >= MOOD_THRESHOLD).astype(int)
    clf.fit(X, Yb)  # final model uses everything
    return {"pipe": clf, "labels": MOODS}, {
        "rows": len(X), "f1_heldout": round(float(f1_score(Yb[split:], held, average="micro", zero_division=0)), 3),
        "f1_natural": round(float(f1_score(nat_Y, nat_pred, average="micro", zero_division=0)), 3),
        "natural_examples": [{"text": t, "expected": y, "predicted": [MOODS[j] for j in np.flatnonzero(p)]}
                             for (t, y), p in zip(mood_data.NATURAL_TEST, nat_pred)]}


def train(feedback=None, verbose=True) -> dict:
    t0 = time.time()
    places = place_pool()
    sat, sat_m = train_satisfaction(places, feedback)
    crowd, crowd_m = train_crowd(places)
    mood, mood_m = train_mood()
    os.makedirs(MODEL_DIR, exist_ok=True)
    prev = read_metrics()
    version = (prev.get("version", 0) + 1) if prev else 1
    meta = {"version": version, "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "seconds": round(time.time() - t0, 1),
            "features": FEATURES, "satisfaction": sat_m, "crowd": crowd_m, "mood": mood_m,
            "data": {"kaggle_places": len(kaggle_places()), "catalogue_places": len(places) - len(kaggle_places()),
                     "synthetic_satisfaction_rows": sat_m["rows_synthetic"], "synthetic_crowd_rows": crowd_m["rows"],
                     "mood_sentences": mood_m["rows"], "feedback_rows": sat_m["rows_feedback"]},
            "history": (prev.get("history", []) if prev else []) + [{"version": version, "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                                                                    "mae": sat_m["mae"], "feedback_rows": sat_m["rows_feedback"]}]}
    joblib.dump(sat, os.path.join(MODEL_DIR, "satisfaction.joblib"), compress=3)
    joblib.dump(crowd, os.path.join(MODEL_DIR, "crowd.joblib"), compress=3)
    joblib.dump(mood, os.path.join(MODEL_DIR, "mood.joblib"), compress=3)
    with open(os.path.join(MODEL_DIR, "metrics.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=1)
    if verbose:
        print(f"v{version} in {meta['seconds']}s · satisfaction MAE {sat_m['mae']} (mean baseline {sat_m['baseline_mean_mae']}, "
              f"rating-only {sat_m['baseline_rating_only_mae']}) R² {sat_m['r2']} · crowd MAE {crowd_m['mae']} R² {crowd_m['r2']} · "
              f"mood F1 {mood_m['f1_heldout']} / natural {mood_m['f1_natural']} · tests "
              f"{sum(t['passed'] for t in sat_m['tests'])}/{len(sat_m['tests'])}")
    return meta


def read_metrics() -> dict | None:
    path = os.path.join(MODEL_DIR, "metrics.json")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


if __name__ == "__main__":
    m = train()
    for t in m["satisfaction"]["tests"]:
        print(("PASS " if t["passed"] else "FAIL ") + t["test"])
    for ex in m["mood"]["natural_examples"]:
        print(ex)
