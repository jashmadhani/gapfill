"""Real data: the Kaggle "Top Indian Places to Visit" dataset (325 attractions with Google ratings, review counts,
entrance fees, visit durations, best time and weekly offs), plus the curated TourCraft catalogue.

Source: kaggle.com/datasets/saketk511/travel-dataset-guide-to-indias-must-see-places (see /CREDITS.md).
"""
import csv
import os

from .features import IO
from .priors import CAT_TAGS, DEFAULT_TYPE, TYPE_PRIORS

KAGGLE_PATH = os.path.join(os.path.dirname(__file__), "data", "kaggle_top_indian_places.csv")
WEEKDAYS = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6}
# Kaggle city -> TourCraft destination key
CITY_DEST = {"Delhi": "delhi", "Agra": "agra", "Jaipur": "jaipur", "Udaipur": "udaipur", "Jodhpur": "jodhpur",
             "Jaisalmer": "jaisalmer", "Pushkar": "pushkar", "Sawai Madhopur": "ranthambore", "Bikaner": "bikaner",
             "Chittorgarh": "chittorgarh", "Mount Abu": "mount_abu", "Bundi": "bundi"}


def _f(v, default=0.0):
    try:
        return float(str(v).strip())
    except (TypeError, ValueError):
        return default


def kaggle_rows() -> list[dict]:
    with open(KAGGLE_PATH, encoding="utf-8") as fh:
        rows = []
        for r in csv.DictReader(fh):
            rows.append({
                "city": r["City"].strip(), "state": r["State"].strip(), "name": r["Name"].strip(), "type": r["Type"].strip(),
                "significance": r["Significance"].strip(), "year": r["Establishment Year"].strip(),
                "hours": _f(r["time needed to visit in hrs"], 1.5), "rating": _f(r["Google review rating"], 4.3),
                "fee": _f(r["Entrance Fee in INR"]), "weekly_off": r["Weekly Off"].strip(),
                "reviews_lakh": _f(r["Number of google review in lakhs"], 0.1), "best_time": r["Best Time to visit"].strip().lower(),
            })
        return rows


def kaggle_place(r: dict) -> dict:
    cat, inten, stairs, walk, seat, shade, indoor, min_age, kids = TYPE_PRIORS.get(r["type"], DEFAULT_TYPE)
    if r["significance"] in ("Adventure", "Trekking"):
        cat = "adventure"
    return {"id": f"k:{r['city']}:{r['name']}", "title": r["name"], "city": r["city"], "category": cat,
            "intensity": inten, "stairs": stairs, "walk_km": walk, "seating": seat, "shade": shade, "indoor": indoor,
            "duration_min": max(30, min(360, r["hours"] * 60)), "rating": r["rating"], "popularity": r["reviews_lakh"],
            "kid_friendly": kids, "min_age": min_age, "price": r["fee"], "tags": CAT_TAGS.get(cat, []),
            "best_time": r["best_time"], "weekly_off": WEEKDAYS.get(r["weekly_off"])}


def kaggle_places() -> list[dict]:
    return [kaggle_place(r) for r in kaggle_rows()]


def kaggle_lookup() -> dict:
    return {(r["city"], r["name"]): r for r in kaggle_rows()}


def offering_place(o: dict) -> dict:
    """A catalogue activity (DB row or seed tuple as dict) in model terms."""
    return {"id": o.get("id"), "title": o.get("title"), "category": o.get("category") or "heritage",
            "intensity": o.get("intensity") or 2, "stairs": o.get("stairs") or 0.0, "walk_km": o.get("walk_km") or 1.0,
            "seating": o.get("seating") or 0.3, "shade": o.get("shade") or 0.3, "indoor": IO.get(o.get("indoor_outdoor"), 0.0),
            "duration_min": o.get("duration_min") or 90, "rating": o.get("rating") or 4.3, "popularity": o.get("popularity") or 0.1,
            "kid_friendly": o.get("kid_friendly", True), "min_age": o.get("min_age") or 0, "price": o.get("price") or 0,
            "tags": o.get("tags") or [], "best_time": o.get("best_time") or "all"}
