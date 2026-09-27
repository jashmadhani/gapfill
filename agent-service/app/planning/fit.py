"""Per-person fit for a place, from the bundled satisfaction and crowd models (app/ml).

Thin adapter: it builds the member and context dicts the models expect and shapes their output for
the plan (chips per traveller, a group score, and the reasons a person is held back).
"""

from datetime import date, timedelta

from ..ml import infer as ML
from ..ml.priors import BAND_LABEL, band_of

# Used when the traveller has not told us who is coming (e.g. planning through the chat bar).
_DEFAULTS = {
    "solo": [("You", 32)],
    "couple": [("You", 32), ("Partner", 31)],
    "family": [("Parent 1", 38), ("Parent 2", 36), ("Child", 9)],
    "large_group": [(f"Traveller {i}", a) for i, a in enumerate((28, 31, 34, 37, 40), start=1)],
}


def normalise_members(members: list[dict] | None, group_type: str, theme_tags: list[str]) -> list[dict]:
    rows = members or [{"name": n, "age": a} for n, a in _DEFAULTS.get(group_type, _DEFAULTS["solo"])]
    out = []
    for i, m in enumerate(rows):
        out.append({
            "name": (m.get("name") or f"Traveller {i + 1}").strip()[:40],
            "age": int(m.get("age") or 32),
            "step_free": bool(m.get("stepFree") or m.get("step_free")),
            "interests": list(m.get("interests") or theme_tags),
        })
    return out


def evaluate(members: list[dict], place: dict, *, on: date, start_min: int, theme_tags: list[str]) -> dict:
    """Everyone's fit for this place at this time of day, plus the group score and crowd level."""
    ml_place = place["ml"]
    hour = start_min / 60
    crowd = int(ML.crowd(ml_place, on, hour))
    ctx = {"start_min": start_min, "month": on.month, "crowd": crowd, "rain": False, "group_interests": theme_tags}
    fits = ML.member_fits(members, ml_place, ctx, with_reasons=True)
    return {
        "members": [
            {k: v for k, v in {"name": f["name"], "age": f["age"], "band": f["band"], "fit": f["fit"], "veto": f["veto"],
                               "reasons": f.get("reasons") or [], "positive": f.get("positive")}.items()}
            for f in fits
        ],
        "group": ML.group_fit(fits),
        "crowd": crowd,
    }


def day_date(start_date: str, index: int) -> date:
    return date.fromisoformat(start_date[:10]) + timedelta(days=index)


def summarise(members: list[dict], cards: list[dict]) -> dict | None:
    """How the whole plan works for each person: their average fit over the stops they can do, and the stops
    they are best matched with. `fairness` is the least-happy person's average, so nobody is quietly left behind."""
    stops = [c for c in cards if c.get("memberFits")]
    if not stops:
        return None
    out = []
    for m in members:
        rows = [(c["title"], next((f for f in c["memberFits"] if f["name"] == m["name"]), None)) for c in stops]
        rows = [(title, f) for title, f in rows if f and not f.get("veto")]
        avg = round(sum(f["fit"] for _, f in rows) / len(rows)) if rows else 0
        best = [title for title, f in sorted(rows, key=lambda r: -r[1]["fit"]) if f["fit"] >= 80][:2]
        out.append({"name": m["name"], "age": m["age"], "band": BAND_LABEL[band_of(m["age"])], "stepFree": m["step_free"], "avg": avg, "highlights": best})
    return {"fairness": min((o["avg"] for o in out), default=0), "members": out}
