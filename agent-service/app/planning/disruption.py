"""Disruption engine: when something changes (rain, the group running late, a stop becoming unavailable, a smaller
budget, a mood check-in), work out what is affected and prepare 2-3 recovery options, each scored on predicted group
fit, cost and time lost. The trip admin picks one; nothing changes until they do.

Ported from the original adapt.py and rebuilt on this stack's plan documents. The analysis functions are pure (no I/O)
so they can be tested; `run_trigger` fetches the plan and catalog, analyses, and stores the event for the app to show.
Group fit comes from the same satisfaction model the planner uses, with rain and moods as context.
"""

from datetime import date, datetime

from ..next_client import NextClient
from .catalog import live_to_place, to_place
from .fit import day_date, evaluate, normalise_members

LABELS = {"weather": "Weather alert", "running_late": "Running late", "unavailable": "No longer available",
          "budget_change": "Budget change", "mood_change": "Mood check-in"}
DAY_END_MIN = 22 * 60


def _start_min(iso: str) -> int:
    t = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return t.hour * 60 + t.minute


def _fmt(minutes: int) -> str:
    h, m = divmod(int(minutes), 60)
    return f"{(h - 1) % 12 + 1}:{m:02d} {'AM' if h < 12 else 'PM'}"


class Day:
    """One day of the plan with its catalog-backed stops, and a helper to score any place for the group."""

    def __init__(self, members: list[dict], cards: list[dict], pool: dict[str, dict], on: date, theme_tags: list[str], rain=False, moods=None):
        self.members, self.cards, self.pool, self.on, self.theme_tags = members, cards, pool, on, theme_tags
        self.rain, self.moods = rain, moods or []
        self.in_plan = {c.get("poiId") for c in cards if c.get("poiId")}

    def stops(self) -> list[dict]:
        out = []
        for c in self.cards:
            place = self.pool.get(c.get("poiId") or "")
            if c["type"] == "activity" and place:
                out.append({"card": c, "place": place, "start": _start_min(c["startTime"])})
        return sorted(out, key=lambda s: s["start"])

    def fit(self, place: dict, start: int, rain: bool | None = None) -> dict:
        return evaluate(self.members, place, on=self.on, start_min=start, theme_tags=self.theme_tags, moods=self.moods,
                        rain=self.rain if rain is None else rain)

    def best_swap(self, stop: dict, used: set, want=lambda p: True) -> tuple[dict, dict] | None:
        best = None
        for pid, place in self.pool.items():
            if pid in self.in_plan or pid in used or not want(place):
                continue
            if abs(place["dwellMin"] - stop["place"]["dwellMin"]) > 60:
                continue
            if not (place["openMin"] <= stop["start"] and stop["start"] + place["dwellMin"] <= place["closeMin"]):
                continue
            if self.on.weekday() in (place.get("closedWeekdays") or []):
                continue
            f = self.fit(place, stop["start"])
            if any(m["veto"] for m in f["members"]):
                continue
            if best is None or f["group"] > best[1]["group"]:
                best = (place, f)
        return best


def _avg(xs):
    xs = [x for x in xs if x is not None]
    return round(sum(xs) / len(xs)) if xs else 0


def _option(key, label, summary, changes, *, fit, cost, lost_min):
    return {"key": key, "label": label, "summary": summary, "changes": changes, "fit": fit, "costPerPerson": round(cost), "lostMin": int(lost_min)}


def score_and_mark(options: list[dict]) -> list[dict]:
    """Higher fit good, extra cost and lost time bad. The best-scoring option is marked recommended."""
    if not options:
        return options
    max_cost = max(1, max(abs(o["costPerPerson"]) for o in options))
    max_lost = max(1, max(o["lostMin"] for o in options))
    for o in options:
        o["score"] = round(0.6 * o["fit"] / 100 - 0.25 * max(0, o["costPerPerson"]) / max_cost - 0.15 * o["lostMin"] / max_lost, 3)
    best = max(options, key=lambda o: o["score"])
    for o in options:
        o["recommended"] = o is best
    return options


def _swap_change(stop, place, reason):
    return {"op": "swap", "itemId": stop["card"]["itemId"], "from": stop["card"]["title"], "poiId": place["poiId"], "title": place["name"],
            "price": place["price"], "durationMin": place["dwellMin"], "location": {"lat": place["lat"], "lng": place["lng"]},
            "imageUrl": place.get("imageUrl"), "reason": reason}


# ---------------------------------------------------------------- analyses (pure)
def analyse_weather(d: Day) -> dict | None:
    all_stops = d.stops()
    affected_ids = {s["card"]["itemId"] for s in all_stops if s["place"].get("indoorOutdoor") == "outdoor"}
    affected = [s for s in all_stops if s["card"]["itemId"] in affected_ids]
    if not affected:
        return None
    unaffected = [s for s in all_stops if s["card"]["itemId"] not in affected_ids]
    dry_unaffected = [d.fit(s["place"], s["start"], rain=False)["group"] for s in unaffected]
    wet_all = [d.fit(s["place"], s["start"])["group"] for s in all_stops]
    swaps, used = [], set()
    for s in affected:
        hit = d.best_swap(s, used, want=lambda p: p.get("indoorOutdoor") in ("indoor", "mixed"))
        if hit:
            used.add(hit[0]["poiId"])
            swaps.append((s, hit))
    swapped_ids = {s["card"]["itemId"] for s, _ in swaps}
    options = []
    if swaps:
        wet_left = [d.fit(s["place"], s["start"])["group"] for s in affected if s["card"]["itemId"] not in swapped_ids]
        options.append(_option("A", "Swap outdoor stops for indoor ones",
                               "; ".join(f"{s['card']['title']} -> {p['name']} ({f['group']}% fit)" for s, (p, f) in swaps),
                               [_swap_change(s, p, "Indoor alternative for rain") for s, (p, f) in swaps],
                               fit=_avg([f["group"] for _, (_, f) in swaps] + wet_left),
                               cost=sum(p["price"] - (s["card"].get("price") or 0) for s, (p, _) in swaps), lost_min=0))
    options.append(_option("B" if swaps else "A", "Skip the outdoor stops", "A lighter day: " + ", ".join(s["card"]["title"] for s in affected),
                           [{"op": "remove", "itemId": s["card"]["itemId"], "from": s["card"]["title"], "reason": "Skipped for rain"} for s in affected],
                           fit=_avg(dry_unaffected) if unaffected else 50,
                           cost=-sum(s["card"].get("price") or 0 for s in affected), lost_min=sum(s["place"]["dwellMin"] for s in affected)))
    options.append(_option(chr(ord(options[-1]["key"]) + 1), "Keep the plan", "Go ahead in the rain",
                           [], fit=_avg(wet_all), cost=0, lost_min=0))
    return {"kind": "weather", "reason": f"Rain expected on this day: {len(affected)} outdoor stop{'s' if len(affected) > 1 else ''} affected",
            "impact": [s["card"]["title"] for s in affected], "options": score_and_mark(options)}


def analyse_late(d: Day, minutes: int, from_min: int = 0) -> dict | None:
    later = [s for s in d.stops() if s["start"] >= from_min]
    if not later:
        return None
    shifted, dropped = [], []
    for s in later:
        new_start = s["start"] + minutes
        if new_start + s["place"]["dwellMin"] > min(s["place"]["closeMin"], DAY_END_MIN):
            dropped.append(s)
        else:
            shifted.append(s)
    options = [
        _option("A", f"Push the day back {minutes} min",
                ", ".join(f"{s['card']['title']} {_fmt(s['start'] + minutes)}" for s in shifted) + (f"; drops {', '.join(s['card']['title'] for s in dropped)} (closes too early)" if dropped else ""),
                [{"op": "shift", "itemId": s["card"]["itemId"], "from": s["card"]["title"], "minutes": minutes} for s in shifted]
                + [{"op": "remove", "itemId": s["card"]["itemId"], "from": s["card"]["title"], "reason": "Closes before the new time"} for s in dropped],
                fit=_avg([d.fit(s["place"], s["start"] + minutes)["group"] for s in shifted]),
                cost=-sum(s["card"].get("price") or 0 for s in dropped), lost_min=sum(s["place"]["dwellMin"] for s in dropped)),
        _option("B", f"Skip {later[0]['card']['title']} and keep the rest on time", "Everything after it stays as planned",
                [{"op": "remove", "itemId": later[0]["card"]["itemId"], "from": later[0]["card"]["title"], "reason": "Skipped to make up time"}],
                fit=_avg([d.fit(s["place"], s["start"])["group"] for s in later[1:]]) if len(later) > 1 else 50,
                cost=-(later[0]["card"].get("price") or 0), lost_min=later[0]["place"]["dwellMin"]),
    ]
    return {"kind": "running_late", "reason": f"Running {minutes} min late", "impact": [s["card"]["title"] for s in later], "options": score_and_mark(options)}


def analyse_unavailable(d: Day, item_id: str) -> dict | None:
    stop = next((s for s in d.stops() if s["card"]["itemId"] == item_id), None)
    if not stop:
        return None
    options = []
    hit = d.best_swap(stop, set())
    if hit:
        p, f = hit
        options.append(_option("A", f"Replace with {p['name']}", f"{f['group']}% group fit, {p['rating']:.1f} rating",
                               [_swap_change(stop, p, "Replacement for an unavailable stop")], fit=f["group"], cost=p["price"] - (stop["card"].get("price") or 0), lost_min=0))
    options.append(_option("B" if hit else "A", "Drop it", "Free time instead", [{"op": "remove", "itemId": item_id, "from": stop["card"]["title"], "reason": "No longer available"}],
                           fit=_avg([d.fit(s["place"], s["start"])["group"] for s in d.stops() if s is not stop]) or 50,
                           cost=-(stop["card"].get("price") or 0), lost_min=stop["place"]["dwellMin"]))
    return {"kind": "unavailable", "reason": f"{stop['card']['title']} is no longer available", "impact": [stop["card"]["title"]], "options": score_and_mark(options)}


def analyse_budget(days: list[Day], total_per_person: float, budget_per_person: float) -> dict | None:
    over = total_per_person - budget_per_person
    if over <= 0:
        return None
    stops = [(d, s, d.fit(s["place"], s["start"])["group"]) for d in days for s in d.stops() if (s["card"].get("price") or 0) > 0]
    # A: drop the stops that give the least fit per rupee until within budget
    drop, saved = [], 0
    for d, s, f in sorted(stops, key=lambda x: x[2] / max(1, x[1]["card"]["price"])):
        if saved >= over:
            break
        drop.append((s, f))
        saved += s["card"]["price"]
    # B: swap the priciest stops for cheaper, similar-fit ones
    swaps, used, saved_b = [], set(), 0
    for d, s, f in sorted(stops, key=lambda x: -x[1]["card"]["price"]):
        if saved_b >= over:
            break
        hit = d.best_swap(s, used, want=lambda p, s=s: p["price"] < (s["card"]["price"] or 0) * 0.6)
        if hit and hit[1]["group"] >= f - 10:
            used.add(hit[0]["poiId"])
            swaps.append((s, hit))
            saved_b += s["card"]["price"] - hit[0]["price"]
    options = [_option("A", "Drop the least valuable stops", ", ".join(s["card"]["title"] for s, _ in drop),
                       [{"op": "remove", "itemId": s["card"]["itemId"], "from": s["card"]["title"], "reason": "Over budget"} for s, _ in drop],
                       fit=_avg([f for _, _, f in stops if all(f is not x for _, x in drop)]), cost=-saved, lost_min=sum(s["place"]["dwellMin"] for s, _ in drop))]
    if swaps:
        options.append(_option("B", "Swap to cheaper alternatives", "; ".join(f"{s['card']['title']} -> {p['name']}" for s, (p, _) in swaps),
                               [_swap_change(s, p, "Cheaper alternative") for s, (p, _) in swaps],
                               fit=_avg([f["group"] for _, (_, f) in swaps]), cost=-saved_b, lost_min=0))
    return {"kind": "budget_change", "reason": f"Over the new budget by Rs. {round(over):,} per person", "impact": [s["card"]["title"] for s, _ in drop], "options": score_and_mark(options)}


def from_mood(d: Day, proposals: list[dict], moods: list[str]) -> dict | None:
    if not proposals:
        return None
    stops = {s["card"]["itemId"]: s for s in d.stops()}
    changes = [_swap_change(stops[p["replaceItemId"]], d.pool[p["withPoiId"]], f"Better for a {', '.join(moods)} group")
               for p in proposals if p["replaceItemId"] in stops and p["withPoiId"] in d.pool]
    options = [_option("A", "Swap for better-fitting stops", "; ".join(f"{p['replace']} -> {p['with']} ({p['fitWith']}% fit)" for p in proposals), changes,
                       fit=_avg([p["fitWith"] for p in proposals]), cost=sum(p["priceChange"] for p in proposals), lost_min=0),
               _option("B", "Keep the plan", "No changes", [], fit=_avg([p["fitNow"] for p in proposals]), cost=0, lost_min=0)]
    return {"kind": "mood_change", "reason": f"Group mood: {', '.join(moods)}", "impact": [p["replace"] for p in proposals], "options": score_and_mark(options)}


# ---------------------------------------------------------------- I/O
def _pool_from_cards(cards_by_day: list[list[dict]], pool: dict[str, dict]) -> dict[str, dict]:
    """Non-catalog destinations have no /api/agent/catalog pool to swap within - rebuild one from the
    plan's OWN cards instead, so "it's raining"/"running late" have somewhere to look for an
    indoor/later alternative even when the trip isn't in the curated 12. Cards from a plan generated
    before this fix carry poiId: None and are silently skipped (a known limitation, not a crash)."""
    for cards in cards_by_day:
        for c in cards:
            poi_id = c.get("poiId")
            if not poi_id or poi_id in pool or c.get("type") != "activity":
                continue
            loc = c.get("location") or {}
            place = live_to_place({"name": c["title"], "lat": loc.get("lat", 0), "lng": loc.get("lng", 0), "categories": [c.get("activityType")] if c.get("activityType") else []},
                                   c.get("durationMin") or 60, c.get("typicalSpend") or 0)
            place["id"] = place["poiId"] = place["ml"]["id"] = poi_id
            if c.get("rating"):
                place["rating"] = c["rating"]
            pool[poi_id] = place
    return pool


async def load_days(client: NextClient, rain_days: set[int] | None = None, moods=None, trip: str = "current") -> tuple[dict, list[Day]]:
    data = await client.get("/api/agent/plan-cards", {"trip": trip})
    catalog = await client.get("/api/agent/catalog", {"q": data["destination"]}) if data.get("days") else {"pois": []}
    pool = {p["id"]: to_place(p) | {"poiId": p["id"]} for p in catalog.get("pois", [])}
    pool = _pool_from_cards(data.get("days") or [], pool)
    members = normalise_members(data.get("members"), data.get("groupType", "solo"), data.get("themeTags", []))
    days = [Day(members, cards, pool, day_date(data["startDate"], i), data.get("themeTags", []), rain=(i + 1) in (rain_days or set()), moods=moods)
            for i, cards in enumerate(data.get("days") or [])]
    return data, days


async def store(client: NextClient, event: dict, day: int | None, source: str, trip_id: str | None = None) -> dict:
    saved = await client.post("/api/agent/disruptions", {**event, "label": LABELS[event["kind"]], "day": day, "source": source, "tripId": trip_id})
    return {**event, "id": saved.get("id"), "label": LABELS[event["kind"]], "day": day}


async def run_trigger(client: NextClient, trigger: dict, source: str = "traveller") -> dict:
    """trigger: {type: weather|running_late|unavailable|budget_change, day?, minutes?, fromTime?, itemId?, budgetPerPerson?}"""
    kind = trigger.get("type")
    day = trigger.get("day")
    data, days = await load_days(client, rain_days={day or 1} if kind == "weather" else None, trip=trigger.get("tripId") or "current")
    if not days:
        return {"message": "There's no plan yet to adjust."}
    if not data.get("days"):
        return {"message": "There's no plan yet to adjust."}
    if not days[0].pool:
        return {"message": "This plan was made before live re-planning was added here - regenerate it to enable this."}
    idx = max(0, min((day or 1) - 1, len(days) - 1))
    if kind == "weather":
        event = analyse_weather(days[idx])
    elif kind == "running_late":
        start = trigger.get("fromTime")
        from_min = int(start.split(":")[0]) * 60 + int(start.split(":")[1]) if start else 0
        event = analyse_late(days[idx], int(trigger.get("minutes") or 45), from_min)
    elif kind == "unavailable":
        idx = next((i for i, d in enumerate(days) if any(c["itemId"] == trigger.get("itemId") for c in d.cards)), idx)
        event = analyse_unavailable(days[idx], trigger.get("itemId", ""))
    elif kind == "budget_change":
        people = max(1, len(days[0].members))
        total = sum(c.get("price") or 0 for d in days for c in d.cards)
        event = analyse_budget(days, total, float(trigger.get("budgetPerPerson") or 0) or float(trigger.get("budget", 0)) / people)
        idx = None
    else:
        return {"message": "Unknown trigger."}
    if not event:
        return {"message": "Nothing in the plan is affected."}
    return await store(client, event, None if idx is None else idx + 1, source, data.get("tripId"))
