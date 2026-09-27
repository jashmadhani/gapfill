"""Mood check-in: "the kids are cranky and it's boiling" -> which of today's stops now fit worse, and what would
fit better instead.

Reading the mood: the NuGen-aligned model when one is deployed, otherwise the local scikit-learn mood model. The
re-scoring reuses the same satisfaction model as the planner, with the moods as extra context, so a "tired" group
sees intense stops drop and calmer ones rise. It only PROPOSES swaps; changing the plan stays with the trip admin.
"""

from datetime import datetime

from ..ml import infer as ML
from ..next_client import NextClient
from ..nugen import mood as nugen_mood
from .catalog import to_place
from .fit import day_date, evaluate, normalise_members

DROP_TO_FLAG = 8  # a stop whose group fit falls by this many points under the mood is flagged
BETTER_BY = 10  # a swap must beat the weak stop by this many points
MAX_PROPOSALS = 3


async def read_moods(text: str) -> tuple[list[str], str]:
    """(moods, source) where source is 'nugen' or 'local'."""
    moods = await nugen_mood.parse_mood(text)
    if moods is not None:
        return moods, "nugen"
    return [m["mood"] for m in ML.parse_mood(text)], "local"


def _start_min(iso: str) -> int:
    t = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return t.hour * 60 + t.minute


def analyse(members: list[dict], day_cards: list[dict], pool: dict[str, dict], *, on, theme_tags: list[str], moods: list[str]) -> dict:
    """Pure function (no I/O): score the day's stops with and without the moods, and find better-fitting swaps."""
    in_plan = {c["poiId"] for c in day_cards if c.get("poiId")}
    stops = []
    for c in day_cards:
        place = pool.get(c.get("poiId") or "")
        if c["type"] != "activity" or not place:
            continue
        start = _start_min(c["startTime"])
        base = evaluate(members, place, on=on, start_min=start, theme_tags=theme_tags)
        now = evaluate(members, place, on=on, start_min=start, theme_tags=theme_tags, moods=moods)
        stops.append({"card": c, "place": place, "start": start, "before": base["group"], "after": now["group"], "members": now["members"]})

    weak = sorted((s for s in stops if s["before"] - s["after"] >= DROP_TO_FLAG or s["after"] < 55), key=lambda s: s["after"])
    proposals, used = [], set()
    for w in weak:
        best = None
        for pid, place in pool.items():
            if pid in in_plan or pid in used:
                continue
            if abs(place["dwellMin"] - w["place"]["dwellMin"]) > 45:
                continue
            fit = evaluate(members, place, on=on, start_min=w["start"], theme_tags=theme_tags, moods=moods)
            if any(m["veto"] for m in fit["members"]):
                continue
            if best is None or fit["group"] > best[1]["group"]:
                best = (place, fit)
        if best and best[1]["group"] - w["after"] >= BETTER_BY:
            used.add(best[0]["poiId"])
            proposals.append({
                "replace": w["card"]["title"], "replaceItemId": w["card"]["itemId"], "fitNow": w["after"],
                "with": best[0]["name"], "withPoiId": best[0]["poiId"], "fitWith": best[1]["group"],
                "price": best[0]["price"], "priceChange": best[0]["price"] - (w["card"].get("price") or 0),
            })
        if len(proposals) >= MAX_PROPOSALS:
            break
    return {
        "stops": [{"title": s["card"]["title"], "fitBefore": s["before"], "fitWithMood": s["after"]} for s in stops],
        "proposals": proposals,
    }


async def mood_check_in(client: NextClient, text: str, day: int | None = None) -> dict:
    moods, source = await read_moods(text)
    if not moods:
        return {"moods": [], "source": source, "message": "I couldn't tell how the group feels from that. Ask them to say it in a sentence, like 'the kids are tired and it's very hot'."}

    data = await client.get("/api/agent/plan-cards", {"trip": "current"})
    days = data.get("days") or []
    if not days:
        return {"moods": moods, "source": source, "message": "There's no plan yet to adjust."}
    index = max(0, min((day or 1) - 1, len(days) - 1))
    catalog = await client.get("/api/agent/catalog", {"q": data["destination"]})
    if not catalog.get("pois"):
        return {"moods": moods, "source": source, "message": "This destination has no curated experiences to re-score."}

    pool = {p["id"]: to_place(p) | {"poiId": p["id"]} for p in catalog["pois"]}
    members = normalise_members(data.get("members"), data.get("groupType", "solo"), data.get("themeTags", []))
    result = analyse(members, days[index], pool, on=day_date(data["startDate"], index), theme_tags=data.get("themeTags", []), moods=moods)
    # Store the proposals as a change event so the trip admin can apply them with one tap.
    from .disruption import Day, from_mood, store
    event = from_mood(Day(members, days[index], pool, day_date(data["startDate"], index), data.get("themeTags", []), moods=moods), result["proposals"], moods)
    saved = await store(client, event, index + 1, "traveller", data.get("tripId")) if event else None
    return {"moods": moods, "source": source, "day": index + 1, **result, "changeId": saved and saved.get("id")}
