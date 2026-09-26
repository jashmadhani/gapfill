"""Tour planning engine: destination recommendations, route + night allocation, hotel/transport selection,
activity scheduling, pricing, budget optimisation, conflict detection and alternatives.

Everything here works on plain dicts so it can be reused for drafts, booked tours and replanning.
Deterministic: the same inputs always give the same plan.
"""
import math
from itertools import permutations
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .catalog import PACES, TIERS
from .ml import infer as ML
from .ml.data import offering_place
from .models import Destination, Offering, Review, Vendor

SERVICE_FEE = 0.08  # operator coordination fee
GST = 0.05
CHECKIN = 14 * 60

# ---------------------------------------------------------------- world cache (catalogue in memory)
W: dict = {"dests": {}, "offerings": {}, "vendors": {}}


async def load_world(db: AsyncSession):
    dests = (await db.execute(select(Destination))).scalars().all()
    vendors = (await db.execute(select(Vendor))).scalars().all()
    offs = (await db.execute(select(Offering))).scalars().all()
    reviews = (await db.execute(select(Review))).scalars().all()
    W["dests"] = {d.key: {c.name: getattr(d, c.name) for c in Destination.__table__.columns} for d in dests}
    W["vendors"] = {v.id: {c.name: getattr(v, c.name) for c in Vendor.__table__.columns} for v in vendors}
    extra: dict[int, list] = {}
    for r in reviews:
        extra.setdefault(r.offering_id, []).append(r.rating)
    W["offerings"] = {}
    for o in offs:
        d = {c.name: getattr(o, c.name) for c in Offering.__table__.columns}
        v = W["vendors"].get(o.vendor_id, {})
        d["vendor_name"] = v.get("name")
        d["available"] = o.status == "open" and v.get("status") == "open"
        if o.id in extra:  # fold in reviews left through the platform
            n = d["rating_count"]
            d["rating"] = round((d["rating"] * n + sum(extra[o.id])) / (n + len(extra[o.id])), 2)
            d["rating_count"] = n + len(extra[o.id])
        if d["kind"] == "activity":
            d["place"] = offering_place(d)
        W["offerings"][o.id] = d


def off(oid):
    return W["offerings"].get(oid)


def acts_in(dest):
    return [o for o in W["offerings"].values() if o["kind"] == "activity" and o["dest_key"] == dest]


def hotels_in(dest):
    return sorted([o for o in W["offerings"].values() if o["kind"] == "hotel" and o["dest_key"] == dest],
                  key=lambda h: TIERS.index(h["tier"]))


def transport_offering(mode):
    return next((o for o in W["offerings"].values() if o["kind"] == "transport" and o["mode"] == mode), None)


# ---------------------------------------------------------------- time + geo helpers
def hm(s: str) -> int:
    h, m = s.split(":")
    return int(h) * 60 + int(m)


def label(mins: int) -> str:
    mins = int(mins) % (24 * 60)
    h, m = divmod(mins, 60)
    return f"{h % 12 or 12}:{m:02d} {'AM' if h < 12 else 'PM'}"


def dur_label(mins: int) -> str:
    h, m = divmod(int(mins), 60)
    return f"{h}h {m:02d}m" if h and m else f"{h}h" if h else f"{m} min"


def haversine(a, b):
    r = 6371
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def city_km(a: str, b: str) -> float:
    da, db_ = W["dests"][a], W["dests"][b]
    return round(haversine((da["lat"], da["lng"]), (db_["lat"], db_["lng"])) * 1.25)


def local_min(p, q) -> int:
    """Minutes to get between two points in the same city (auto/cab)."""
    if p is None or q is None:
        return 15
    km = haversine(p, q) * 1.4
    return int(max(10, min(60, km / 18 * 60 + 8)))


def pt(o):
    return (o["lat"], o["lng"]) if o and o.get("lat") else None


def fmt_inr(n) -> str:
    n = int(round(n or 0))
    s = str(abs(n))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts) + "," + tail
    return ("-" if n < 0 else "") + "₹" + s


# ---------------------------------------------------------------- context
def default_members(prefs: dict) -> list:
    """The travelling group as people. Older tours without a member list get a sensible default from the headcount."""
    ms = prefs.get("members") or []
    if ms:
        return [{"name": (m.get("name") or f"Traveler {i + 1}").strip(), "age": int(m.get("age") or 35),
                 "interests": m.get("interests") or [], "step_free": bool(m.get("step_free")), "rest": bool(m.get("rest"))}
                for i, m in enumerate(ms)]
    adults, children = int(prefs.get("adults", 2) or 1), int(prefs.get("children", 0) or 0)
    step = bool((prefs.get("needs") or {}).get("step_free"))
    out = [{"name": "You" if i == 0 else f"Adult {i + 1}", "age": 34 if i % 2 == 0 else 32, "interests": [], "step_free": step and i == 0,
            "rest": False} for i in range(adults)]
    out += [{"name": f"Child {i + 1}", "age": 8, "interests": [], "step_free": False, "rest": False} for i in range(children)]
    return out


def make_ctx(prefs: dict, start_date: date, days: int, route: list, rain: list | None = None) -> dict:
    members = default_members(prefs)
    ages = [m["age"] for m in members]
    adults = sum(1 for a in ages if a >= 12) or 1
    return {
        "start_date": start_date, "days": days, "route": route, "members": members,
        "adults": adults, "children": len(ages) - adults, "travelers": len(members),
        "rooms": max(1, math.ceil(max(1, sum(1 for a in ages if a >= 18)) / 2)),
        "interests": prefs.get("interests") or [], "pace": prefs.get("pace", "balanced"), "moods": list(prefs.get("mood") or []),
        "needs": {"step_free": any(m["step_free"] for m in members)}, "budget": float(prefs.get("budget") or 0),
        "tier": prefs.get("hotel_tier", "standard"), "transport": prefs.get("transport", "best"),
        "rain": {(r["dest"], r["date"]) for r in (rain or [])}, "_fit": {}, "_weights": {},
    }


def day_date(ctx, day: int) -> date:
    return ctx["start_date"] + timedelta(days=day - 1)


def dest_for_day(ctx, day: int) -> str | None:
    route = ctx["route"]
    if not route:
        return None
    for s in route:
        if s["first_day"] <= day < s["first_day"] + s["nights"]:
            return s["dest"]
    return route[-1]["dest"]


def rain_on(ctx, dest, day) -> bool:
    return (dest, day_date(ctx, day).isoformat()) in ctx["rain"]


# ---------------------------------------------------------------- scoring
def interest_match(o, interests) -> list:
    return [t for t in o.get("tags", []) if t in interests]


def item_members(i: dict, ctx) -> list:
    """Who an item is for: split-track items carry their sub-group, everything else is the whole group."""
    names = (i.get("meta") or {}).get("members")
    if not names:
        return ctx["members"]
    return [m for m in ctx["members"] if m["name"] in names] or ctx["members"]


def candidate_starts(o) -> list:
    op, last = hm(o["open"]), hm(o["close"]) - o["duration_min"]
    if last < op:
        return [op]
    return sorted({min(max(t, op), last) for t in (op + 30, 11 * 60, 15 * 60, 18 * 60)})


def ml_ctx(o, ctx, day, start) -> dict:
    d = day_date(ctx, day) if day else ctx["start_date"]
    rain = rain_on(ctx, o["dest_key"], day) if day else False
    return {"start_min": start, "month": d.month, "rain": rain, "moods": ctx.get("moods", []), "group_interests": ctx["interests"],
            "crowd": ML.crowd(o["place"], d, start / 60 + o["duration_min"] / 120, rain)}


def evaluate(o, ctx, day=None, start=None, members=None, reasons=False) -> dict:
    """ML group fit for an activity: per-person predicted enjoyment, safety vetoes, and the fair group score.
    With no start time, the best time of day within opening hours is used."""
    members = members or ctx["members"]
    key = (o["id"], day, start, tuple(m["name"] for m in members), reasons, tuple(sorted(ctx["_weights"].items())), tuple(ctx.get("moods", [])))
    if key in ctx["_fit"]:
        return ctx["_fit"][key]
    best = None
    for st in ([start] if start is not None else candidate_starts(o)):
        mc = ml_ctx(o, ctx, day, st)
        res = ML.member_fits(members, o["place"], mc, with_reasons=reasons)
        ok = [r for r in res if not r["veto"]]
        g = ML.group_fit(ok or res, ctx["_weights"])
        cand = {"fit": 0 if len(ok) < len(res) else g, "fit_eligible": g, "members": res, "vetoed": [r for r in res if r["veto"]],
                "start": st, "crowd": mc["crowd"]}
        if best is None or cand["fit_eligible"] > best["fit_eligible"]:
            best = cand
    ctx["_fit"][key] = best
    return best


def act_score(o, ctx, day=None, start=None, members=None) -> float:
    per_day = max(800, ctx["budget"] * 0.22 / max(1, ctx["travelers"]) / max(1, ctx["days"])) if ctx["budget"] else 2500
    return round(evaluate(o, ctx, day, start, members)["fit_eligible"] / 8 - o["price"] / per_day, 3)


def act_allowed(o, ctx, day=None, check_status=True, members=None) -> str | None:
    """Returns a reason string if the activity can't be used, else None. Safety/access vetoes are hard rules."""
    if check_status and not o["available"]:
        return "unavailable"
    for m in members or ctx["members"]:
        v = ML.veto(m, o["place"])
        if v:
            return f"not for {m['name']} ({m['age']}), {v}"
    if day and day_date(ctx, day).weekday() in (o.get("closed_weekdays") or []):
        return "closed that day"
    return None


def fit_reason(o, ctx, st=None, en=None, delta=None, fit=None) -> str:
    bits = []
    if fit is not None:
        bits.append(f"group fit {fit}%")
    m = interest_match(o, ctx["interests"])
    if m:
        bits.append("matches your " + " & ".join(m[:2]) + " interests")
    bits.append(f"{o['rating']:.1f}★ ({o['rating_count']})")
    if st is not None:
        bits.append(f"fits {label(st)}–{label(en)}")
    if delta:
        bits.append(f"{fmt_inr(abs(delta))} {'more' if delta > 0 else 'less'}")
    if o["indoor_outdoor"] == "indoor":
        bits.append("indoors")
    s = " · ".join(bits)
    return s[0].upper() + s[1:]


# ---------------------------------------------------------------- recommendations (Discover)
def recommend_destinations(interests: list, limit=8) -> list:
    out = []
    for k, d in W["dests"].items():
        acts = acts_in(k)
        tag_hits = [t for t in d["tags"] if t in interests]
        act_hits = [a for a in acts if interest_match(a, interests)]
        avg = sum(a["rating"] for a in acts) / max(1, len(acts))
        score = len(tag_hits) * 2 + len(act_hits) * 0.6 + avg
        reasons = []
        if tag_hits:
            reasons.append("Great for " + ", ".join(tag_hits[:3]))
        if act_hits:
            reasons.append(f"{len(act_hits)} experiences match you")
        out.append({"key": k, "name": d["name"], "region": d["region"], "tagline": d["tagline"], "tags": d["tags"],
                    "ideal_nights": d["ideal_nights"], "score": round(score, 2), "match": tag_hits,
                    "reasons": reasons or ["Popular with our travelers"], "best_months": d["best_months"],
                    "from_price": min((a["price"] for a in acts), default=0), "experiences": len(acts),
                    "lat": d["lat"], "lng": d["lng"]})
    out.sort(key=lambda x: -x["score"])
    return out[:limit]


def recommend_experiences(interests: list, dests: list | None = None, limit=10, ctx=None) -> list:
    ctx = ctx or make_ctx({"interests": interests}, date.today(), 1, [])
    pool = [o for o in W["offerings"].values() if o["kind"] == "activity" and o["available"]
            and (not dests or o["dest_key"] in dests)]
    pool.sort(key=lambda o: -act_score(o, ctx))
    return pool[:limit]


# ---------------------------------------------------------------- transport
DEPART = {"arrive": {"car": "07:30", "train": "06:30", "flight": "08:00"},
          "between": {"car": "08:30", "train": "07:00", "flight": "09:30"},
          "depart": {"car": "13:00", "train": "14:30", "flight": "16:00"}}


def transport_quote(mode: str, a: str, b: str, ctx, depart_min: int) -> dict | None:
    km = city_km(a, b)
    da, db_ = W["dests"][a], W["dests"][b]
    o = transport_offering(mode)
    if not o or not o["available"]:
        return None
    n = ctx["travelers"]
    if mode == "car":
        vehicle, mult = ("Sedan", 1) if n <= 3 else ("SUV", 1.3) if n <= 6 else ("Tempo Traveller", 1.9)
        price = round(max(km, 150) * o["price"] * mult + 500, -1)
        duration = int(km / 50 * 60 + 20)
        return {"mode": "car", "km": km, "duration": duration, "unit_price": price, "qty": 1, "price": price,
                "title": f"{da['name']} → {db_['name']} by private {vehicle}", "vehicle": vehicle,
                "offering_id": o["id"], "vendor_id": o["vendor_id"], "depart": depart_min, "arrive": depart_min + duration}
    if mode == "train":
        if not (da["rail"] and db_["rail"]):
            return None
        pp = round(max(km * o["price"], 350), -1)
        duration = int(km / 55 * 60 + 30)
        return {"mode": "train", "km": km, "duration": duration, "unit_price": pp, "qty": n, "price": pp * n,
                "title": f"{da['name']} → {db_['name']} by AC Chair Car train", "offering_id": o["id"],
                "vendor_id": o["vendor_id"], "depart": depart_min, "arrive": depart_min + duration}
    if mode == "flight":
        if not (da["airport"] and db_["airport"]) or km < 280:
            return None
        pp = round(o["price"] + 4 * km, -1)
        duration = 75 + 150  # flight + airport transfers and check-in
        return {"mode": "flight", "km": km, "duration": duration, "unit_price": pp, "qty": n, "price": pp * n,
                "title": f"{da['name']} → {db_['name']} flight (incl. airport transfers)", "offering_id": o["id"],
                "vendor_id": o["vendor_id"], "depart": depart_min, "arrive": depart_min + duration}
    return None


def best_mode(a, b, ctx, phase: str) -> dict | None:
    pref = ctx["transport"]
    quotes = {m: transport_quote(m, a, b, ctx, hm(DEPART[phase][m])) for m in ("car", "train", "flight")}
    quotes = {m: q for m, q in quotes.items() if q}
    if pref in quotes:
        return quotes[pref]
    if not quotes:
        return None
    # "best": value time at ₹600 per traveler-hour; short hops are simplest by car
    if city_km(a, b) <= 330 and "car" in quotes:
        return quotes["car"]
    return min(quotes.values(), key=lambda q: q["price"] + q["duration"] / 60 * 600 * ctx["travelers"])


def transport_item(q, day, a, b, phase) -> dict:
    return {"day": day, "kind": "transport", "offering_id": q["offering_id"], "vendor_id": q["vendor_id"],
            "title": q["title"], "dest_key": b, "from_key": a, "start_min": q["depart"], "end_min": q["arrive"],
            "nights": 0, "qty": q["qty"], "unit_price": q["unit_price"], "price": q["price"],
            "meta": {"mode": q["mode"], "km": q["km"], "phase": phase, "vehicle": q.get("vehicle")}}


def hotel_item(h, day, nights, ctx, checkin=CHECKIN) -> dict:
    return {"day": day, "kind": "hotel", "offering_id": h["id"], "vendor_id": h["vendor_id"],
            "title": h["title"], "dest_key": h["dest_key"], "from_key": None, "start_min": checkin,
            "end_min": checkin + 30, "nights": nights, "qty": ctx["rooms"], "unit_price": h["price"],
            "price": h["price"] * ctx["rooms"] * nights, "meta": {"tier": h["tier"]}}


def activity_item(o, day, st, ctx, members=None, meta=None) -> dict:
    n = len(members) if members else ctx["travelers"]
    m = {"io": o["indoor_outdoor"]}
    if members:
        m["members"] = [x["name"] for x in members]
    return {"day": day, "kind": "activity", "offering_id": o["id"], "vendor_id": o["vendor_id"],
            "title": o["title"], "dest_key": o["dest_key"], "from_key": None, "start_min": st,
            "end_min": st + o["duration_min"], "nights": 0, "qty": n, "unit_price": o["price"],
            "price": o["price"] * n, "meta": m | (meta or {})}


def rest_item(day, dest, why) -> dict:
    return {"day": day, "kind": "rest", "offering_id": None, "vendor_id": None, "title": "Rest & recharge at the hotel",
            "dest_key": dest, "from_key": None, "start_min": 13 * 60 + 30, "end_min": 15 * 60, "nights": 0, "qty": 0,
            "unit_price": 0, "price": 0, "meta": {"why": why}}


def pick_hotel(dest, ctx) -> dict | None:
    hs = [h for h in hotels_in(dest) if h["available"]]
    if not hs:
        return None
    want = TIERS.index(ctx["tier"]) if ctx["tier"] in TIERS else 1
    if ctx["needs"].get("step_free"):
        want = max(want, 2)  # lifts are only guaranteed from premium upwards
    return min(hs, key=lambda h: (abs(TIERS.index(h["tier"]) - want), -h["rating"]))


# ---------------------------------------------------------------- day scheduling
def day_window(ctx, day, items) -> tuple[int, int]:
    s, e, _ = PACES.get(ctx["pace"], PACES["balanced"])
    start, end = hm(s), hm(e)
    ages = [m["age"] for m in ctx.get("members", [])]
    if any(a <= 7 or a >= 75 for a in ages):  # the day ends when the youngest / oldest member needs it to
        end = min(end, hm("20:00"))
    elif any(a <= 12 or a >= 60 for a in ages):
        end = min(end, hm("20:45"))
    for t in items:
        if t["kind"] != "transport" or t["day"] != day or not live(t):
            continue
        if t["meta"].get("phase") == "depart":
            end = min(end, t["start_min"] - 60)
        else:
            start = max(start, t["end_min"] + 45)  # settle in / check in
    return start, end


def _sequence(seq: list, start: int, end: int, anchor=None, fixed: list | None = None) -> list | None:
    """Place activities in exactly this order into [start, end], respecting opening hours, local travel and fixed blocks."""
    cur, loc, out = start, anchor, []
    for o in seq:
        # sunrise-only experiences (e.g. morning safaris) may start before the day's usual start
        lo = start if hm(o["close"]) - o["duration_min"] >= start or out else max(hm(o["open"]), start - 180)
        st = max((cur if out else lo) + (local_min(loc, pt(o)) if out or anchor else 0), hm(o["open"]))
        if not out and lo < start:
            st = max(lo, hm(o["open"]))
        for fs, fe in sorted(fixed or []):
            if st < fe and st + o["duration_min"] > fs:
                st = max(st, fe + 20)
        en = st + o["duration_min"]
        if en > min(end, hm(o["close"])):
            return None
        out.append((o, st, en))
        cur, loc = en, pt(o)
    return out


def loop_min(seq: list, anchor=None) -> int:
    """Travel minutes for hotel -> each stop in order -> back to the hotel."""
    pts = ([anchor] if anchor else []) + [pt(o) for o in seq] + ([anchor] if anchor else [])
    return sum(local_min(a, b) for a, b in zip(pts, pts[1:]))


def pack(acts: list, start: int, end: int, anchor=None, fixed: list | None = None) -> list | None:
    """Sequence a day's activities as one loop from the hotel: of every order that fits opening hours and fixed
    bookings, take the one with the least travel, so the day never doubles back across town.
    anchor = where the day starts and ends (the hotel). Returns [(o, st, en)] or None."""
    if not acts:
        return []
    if len(acts) <= 7:
        best = None
        for perm in permutations(acts):
            cost = loop_min(perm, anchor)
            if best and cost >= best[0]:
                continue
            seq = _sequence(list(perm), start, end, anchor, fixed)
            if seq:
                best = (cost, seq)
        if best:
            return best[1]
    for order in (lambda o: (hm(o["open"]), hm(o["close"])), lambda o: (hm(o["close"]), hm(o["open"]))):
        seq = _sequence(sorted(acts, key=order), start, end, anchor, fixed)
        if seq:
            return seq
    return None


def day_anchor(ctx, day, items):
    """Where the day starts: the hotel you slept in (or check into) that day, else the city centre."""
    dest = dest_for_day(ctx, day)
    for h in items:
        if h["kind"] == "hotel" and live(h) and h["dest_key"] == dest and h["day"] <= day < h["day"] + max(1, h.get("nights") or 1):
            p = pt(off(h["offering_id"]))
            if p:
                return p
    d = W["dests"].get(dest)
    return (d["lat"], d["lng"]) if d else None


def blocks(items, day, exclude=None, split=None) -> list:
    return sorted([(i["start_min"], i["end_min"]) for i in items if live(i) and i["day"] == day and i.get("id", -1) != exclude
                   and i["kind"] in ("activity", "transport", "rest") and not (split and (i.get("meta") or {}).get("split") == split)])


def group_limits(ctx) -> tuple:
    """Activities per day and high-intensity stops per day, set by the most vulnerable member and the mood."""
    cap = PACES.get(ctx["pace"], PACES["balanced"])[2]
    ages = [m["age"] for m in ctx["members"]]
    if any(a <= 7 or a >= 75 for a in ages):
        cap = min(cap, 3 if ctx["pace"] == "packed" else 2)
    elif any(a >= 60 for a in ages):
        cap = min(cap, 3)
    if "tired" in ctx.get("moods", []):
        cap = max(1, cap - 1)
    hi = 1 if any(a <= 7 or a >= 60 for a in ages) or "tired" in ctx.get("moods", []) else 9
    return cap, hi


def rest_reason(ctx) -> str | None:
    who = [f"{m['name']} ({m['age']})" for m in ctx["members"] if m["age"] <= 7 or m["age"] >= 65 or m.get("rest")]
    if "tired" in ctx.get("moods", []):
        return "Everyone is tired: a proper afternoon break" + (f", especially for {', '.join(who)}" if who else "")
    if who and not (ctx["pace"] == "packed" and all(m["age"] > 5 for m in ctx["members"])):
        return f"Afternoon break for {', '.join(who)} during the hottest hours"
    return None


def split_track(ctx, day, items, used, fixed) -> list:
    """When the best thing for part of the group can't include everyone (age / stairs), run two activities in parallel
    and meet afterwards."""
    dest = dest_for_day(ctx, day)
    members = ctx["members"]
    xs = [o for o in acts_in(dest) if o["id"] not in used and o["available"]
          and day_date(ctx, day).weekday() not in (o.get("closed_weekdays") or [])]
    best = None
    for x in xs:
        a = [m for m in members if not ML.veto(m, x["place"])]
        b = [m for m in members if m not in a]
        if not a or not b:
            continue
        ev = evaluate(x, ctx, day, None, members=a)
        if ev["fit_eligible"] < 70:
            continue
        slot = free_slot(items, day, x, ctx)
        if not slot:
            continue
        st = slot[0]
        for y in xs:
            if y is x or any(ML.veto(m, y["place"]) for m in b):
                continue
            f = fit_in_window(y, st, st + x["duration_min"] + 45)
            if not f or f[0] != st or any(st < be and f[1] > bs for bs, be in blocks(items, day)):
                continue
            evy = evaluate(y, ctx, day, st, members=b)
            if evy["fit_eligible"] < 50:
                continue
            score = ev["fit_eligible"] + evy["fit_eligible"]
            if not best or score > best[0]:
                best = (score, x, a, y, b, st)
    if not best:
        return []
    _, x, a, y, b, st = best
    sid = f"d{day}"
    meet = label(max(st + x["duration_min"], st + y["duration_min"]) + 15)
    return [activity_item(x, day, st, ctx, a, {"split": sid, "track": "A", "partner": y["title"], "meet": meet}),
            activity_item(y, day, st, ctx, b, {"split": sid, "track": "B", "partner": x["title"], "meet": meet})]


def schedule_day(ctx, day, items, used: set) -> list:
    dest = dest_for_day(ctx, day)
    start, end = day_window(ctx, day, items)
    if end - start < 60 or not dest:
        return []
    cap, max_hi = group_limits(ctx)
    fixed = blocks(items, day)
    cands = [o for o in acts_in(dest) if o["id"] not in used and not act_allowed(o, ctx, day)]
    cands.sort(key=lambda o: -act_score(o, ctx, day))
    chosen: list = []
    best = []
    hi = 0
    anchor = day_anchor(ctx, day, items)
    for o in cands:
        if len(chosen) >= cap:
            break
        if o.get("intensity", 2) >= 4 and hi >= max_hi:
            continue
        trial = pack(chosen + [o], start, end, anchor, fixed)
        if trial:
            chosen.append(o)
            best = trial
            hi += o.get("intensity", 2) >= 4
    out = [activity_item(o, day, st, ctx) for o, st, _ in best]
    if len(best) >= 3:
        naive = sorted((o for o, _, _ in best), key=lambda o: (hm(o["open"]), hm(o["close"])))
        saved = loop_min(naive, anchor) - loop_min([o for o, _, _ in best], anchor)
        if saved >= 5:
            ctx.setdefault("_route_notes", []).append(
                f"Day {day} runs as one loop from your hotel, saving about {saved} min of back-and-forth travel.")
    if len(ctx["members"]) >= 2:
        out += split_track(ctx, day, items + out, used | {o["id"] for o in chosen}, fixed)
    return out


# ---------------------------------------------------------------- whole-tour planning
def order_route(dests: list, start_city: str) -> list:
    left = list(dict.fromkeys(dests))
    out, cur = [], start_city
    while left:
        nxt = min(left, key=lambda d: city_km(cur, d) if cur in W["dests"] else 0)
        out.append(nxt)
        left.remove(nxt)
        cur = nxt
    return out


def allocate_nights(dests: list, nights: int, interests: list, warnings: list) -> list:
    weight = {d: W["dests"][d]["ideal_nights"] + 0.3 * sum(1 for a in acts_in(d) if interest_match(a, interests)) for d in dests}
    if len(dests) > nights:
        keep = sorted(dests, key=lambda d: -weight[d])[:max(1, nights)]
        dropped = [W["dests"][d]["name"] for d in dests if d not in keep]
        warnings.append(f"Not enough nights for every stop, dropped {', '.join(dropped)}. Add days to include them.")
        dests = [d for d in dests if d in keep]
    alloc = {d: 1 for d in dests}
    left = nights - len(dests)
    while left > 0:
        # give the next night to the stop furthest below its ideal (weighted by how much there is to do)
        d = max(dests, key=lambda x: (weight[x] / alloc[x], -dests.index(x)))
        alloc[d] += 1
        left -= 1
    return [{"dest": d, "nights": alloc[d]} for d in dests]


def build_items(ctx, start_city: str, end_city: str, warnings: list, keep_activities: list | None = None) -> list:
    route, days = ctx["route"], ctx["days"]
    items: list = []
    # transfers
    prev = start_city
    for i, s in enumerate(route):
        if s["dest"] != prev:
            q = best_mode(prev, s["dest"], ctx, "arrive" if i == 0 else "between")
            if q:
                items.append(transport_item(q, s["first_day"], prev, s["dest"], "arrive" if i == 0 else "between"))
            else:
                warnings.append(f"No transport available {W['dests'][prev]['name']} → {W['dests'][s['dest']]['name']}.")
        prev = s["dest"]
    if end_city and end_city != prev:
        q = best_mode(prev, end_city, ctx, "depart")
        if q:
            items.append(transport_item(q, days, prev, end_city, "depart"))
    # stays
    for s in route:
        h = pick_hotel(s["dest"], ctx)
        if h:
            arr = next((t["end_min"] for t in items if t["kind"] == "transport" and t["day"] == s["first_day"]
                        and t["dest_key"] == s["dest"]), None)
            items.append(hotel_item(h, s["first_day"], s["nights"], ctx, max(CHECKIN, (arr or 0) + 30)))
            if h["tier"] != ctx["tier"]:
                warnings.append(f"{h['title']} is {h['tier']} (you asked for {ctx['tier']}), "
                                f"{'lift access for step-free needs' if ctx['needs'].get('step_free') else 'closest available'}.")
    # rest blocks for the youngest / oldest / tired
    why = rest_reason(ctx)
    if why:
        for d in range(1, days + 1):
            ws, we = day_window(ctx, d, items)
            if ws <= 12 * 60 + 30 and we >= 16 * 60 + 30:
                items.append(rest_item(d, dest_for_day(ctx, d), why))
    # activities, day by day, rebalancing so nobody is left behind across the trip
    used = set(keep_activities or [])
    sat = {m["name"]: 0.0 for m in ctx["members"]}
    for d in range(1, days + 1):
        for a in schedule_day(ctx, d, items, used):
            used.add(a["offering_id"])
            items.append(a)
            for r in evaluate(off(a["offering_id"]), ctx, d, a["start_min"], item_members(a, ctx))["members"]:
                sat[r["name"]] += r["fit"]
        avg = sum(sat.values()) / max(1, len(sat))
        ctx["_weights"] = {n: max(0.7, min(1.6, 1 + 0.6 * (avg - v) / max(avg, 1))) for n, v in sat.items()}
    ctx["_weights"] = {}
    return items


def plan(prefs: dict, start_date: date, rain: list | None = None) -> dict:
    days = max(2, int(prefs.get("days") or 5))
    interests = prefs.get("interests") or []
    start_city = prefs.get("start_city") or "delhi"
    end_city = prefs.get("end_city") or start_city
    warnings: list = []
    dests = [d for d in (prefs.get("destinations") or []) if d in W["dests"]]
    if not dests:
        n = max(1, min(4, round((days - 1) / 2)))
        dests = [r["key"] for r in recommend_destinations(interests, 8) if r["key"] != start_city][:n]
        warnings.append("Stops picked for you from your interests: " + ", ".join(W["dests"][d]["name"] for d in dests) + ".")
    dests = order_route(dests, start_city)
    route = allocate_nights(dests, days - 1, interests, warnings)
    day = 1
    for s in route:
        s["first_day"] = day
        day += s["nights"]
    ctx = make_ctx(prefs, start_date, days, route, rain)
    items = build_items(ctx, start_city, end_city, warnings)
    notes = optimise(items, ctx) if ctx["budget"] else []
    warnings += ctx.pop("_route_notes", [])
    return {"route": route, "items": items, "notes": notes, "warnings": warnings, "ctx": ctx}


# ---------------------------------------------------------------- pricing
def live(i) -> bool:
    return i.get("status", "planned") not in ("replaced", "cancelled", "dropped")


def price(items: list, ctx) -> dict:
    cats = {"stays": 0, "transport": 0, "experiences": 0, "fees": 0}
    by_day: dict = {}
    for i in items:
        if not live(i):
            continue
        k = {"hotel": "stays", "transport": "transport", "activity": "experiences"}.get(i["kind"], "fees")
        cats[k] += i["price"]
        by_day[i["day"]] = by_day.get(i["day"], 0) + i["price"]
    subtotal = sum(cats.values())
    service = round((subtotal - cats["fees"]) * SERVICE_FEE)
    gst = round((subtotal + service) * GST)
    total = subtotal + service + gst
    budget = ctx.get("budget") or 0
    return {"categories": cats, "subtotal": subtotal, "service_fee": service, "gst": gst, "total": total,
            "per_person": round(total / max(1, ctx["travelers"])), "budget": budget,
            "within_budget": not budget or total <= budget, "over_by": max(0, total - budget) if budget else 0,
            "by_day": [{"day": d, "amount": a} for d, a in sorted(by_day.items())]}


def gross(amount):
    return amount * (1 + SERVICE_FEE) * (1 + GST)


# ---------------------------------------------------------------- budget optimisation
def optimise(items: list, ctx, frozen=(), kinds=("transport", "hotel", "activity")) -> list:
    """Bring the plan under budget with the lowest-impact savings first. Mutates items; returns notes."""
    notes = []
    for _ in range(60):
        p = price(items, ctx)
        if p["within_budget"]:
            break
        moves = []
        for i in items:
            if not live(i) or i.get("id") in frozen or i["kind"] not in kinds:
                continue
            if i["kind"] == "transport":
                for m in ("train", "car"):
                    if m == i["meta"].get("mode"):
                        continue
                    q = transport_quote(m, i["from_key"], i["dest_key"], ctx, i["start_min"])
                    if q and q["price"] < i["price"] and q["duration"] < 11 * 60:
                        moves.append((0.5 + (q["duration"] - (i["end_min"] - i["start_min"])) / 600, i["price"] - q["price"],
                                      ("transport", i, q)))
            elif i["kind"] == "hotel":
                cur = TIERS.index(i["meta"]["tier"])
                if cur > (2 if ctx["needs"].get("step_free") else 0):  # keep lifts for step-free travelers
                    lower = [h for h in hotels_in(i["dest_key"]) if TIERS.index(h["tier"]) == cur - 1 and h["available"]]
                    if lower:
                        h = lower[0]
                        saving = i["price"] - h["price"] * i["qty"] * i["nights"]
                        moves.append((1.0 * i["nights"], saving, ("hotel", i, h)))
            elif i["kind"] == "activity":
                o = off(i["offering_id"])
                day_count = sum(1 for x in items if live(x) and x["kind"] == "activity" and x["day"] == i["day"])
                if day_count > 1 and o:
                    moves.append((1.2 + max(0, act_score(o, ctx)) / 3, i["price"], ("drop", i, None)))
        if not moves:
            break
        # best saving per unit of "experience lost"
        _, saving, (kind, i, new) = max(moves, key=lambda m: m[1] / m[0])
        if kind == "transport":
            notes.append(f"Switched {i['title'].split(' by ')[0].split(' flight')[0]} to {new['mode']}, saves {fmt_inr(gross(saving))}")
            i.update(transport_item(new, i["day"], i["from_key"], i["dest_key"], i["meta"]["phase"]) | {"status": i.get("status", "planned")})
        elif kind == "hotel":
            notes.append(f"{W['dests'][i['dest_key']]['name']}: {i['title']} → {new['title']} ({new['tier']}), saves {fmt_inr(gross(saving))}")
            i.update({"offering_id": new["id"], "vendor_id": new["vendor_id"], "title": new["title"],
                      "unit_price": new["price"], "price": new["price"] * i["qty"] * i["nights"], "meta": {"tier": new["tier"]}})
        else:
            notes.append(f"Dropped {i['title']} (day {i['day']}), saves {fmt_inr(gross(saving))}")
            i["status"] = "cancelled" if i.get("id") else "dropped"
    items[:] = [i for i in items if i.get("status") != "dropped"]
    p = price(items, ctx)
    if not p["within_budget"]:
        notes.append(f"Still {fmt_inr(p['over_by'])} over budget, consider fewer days, fewer stops or a higher budget.")
    elif notes:
        notes.append(f"Now {fmt_inr(p['total'])}, within your {fmt_inr(ctx['budget'])} budget.")
    return notes


# ---------------------------------------------------------------- conflicts + risks
def conflicts(items: list, ctx) -> list:
    out = []
    timed = [i for i in items if live(i) and i["kind"] in ("activity", "transport")]
    for d in range(1, ctx["days"] + 1):
        day_items = sorted([i for i in timed if i["day"] == d], key=lambda i: i["start_min"])
        for a, b in zip(day_items, day_items[1:]):
            if (a.get("meta") or {}).get("split") and (a.get("meta") or {}).get("split") == (b.get("meta") or {}).get("split"):
                continue
            if b["start_min"] < a["end_min"]:
                out.append({"level": "error", "day": d, "item_id": b.get("id"),
                            "text": f"Day {d}: {b['title']} overlaps {a['title']}."})
            elif a["kind"] == "transport" and b["kind"] == "activity" and b["start_min"] - a["end_min"] < 45:
                out.append({"level": "warn", "day": d, "item_id": b.get("id"),
                            "text": f"Day {d}: only {b['start_min'] - a['end_min']} min between arriving and {b['title']}."})
        dest = dest_for_day(ctx, d)
        for i in day_items:
            if i["kind"] != "activity":
                continue
            o = off(i["offering_id"])
            if not o:
                continue
            if i["start_min"] < hm(o["open"]) or i["end_min"] > hm(o["close"]):
                out.append({"level": "error", "day": d, "item_id": i.get("id"),
                            "text": f"Day {d}: {o['title']} is only open {o['open']}–{o['close']}."})
            why = act_allowed(o, ctx, d, members=item_members(i, ctx))
            if why:
                out.append({"level": "error", "day": d, "item_id": i.get("id"), "text": f"Day {d}: {o['title']}, {why}."})
            if o["dest_key"] != dest and not any(t["kind"] == "transport" and t["day"] == d for t in timed):
                out.append({"level": "error", "day": d, "item_id": i.get("id"),
                            "text": f"Day {d}: {o['title']} is in {W['dests'][o['dest_key']]['name']}, but you're in {W['dests'][dest]['name']}."})
            if o["indoor_outdoor"] == "outdoor" and rain_on(ctx, o["dest_key"], d):
                out.append({"level": "warn", "day": d, "item_id": i.get("id"),
                            "text": f"Day {d}: rain forecast in {W['dests'][o['dest_key']]['name']}, {o['title']} is outdoors."})
    for i in items:
        if live(i) and i["kind"] in ("hotel", "transport"):
            o = off(i["offering_id"])
            if o and not o["available"]:
                out.append({"level": "error", "day": i["day"], "item_id": i.get("id"), "text": f"{i['title']} is currently unavailable."})
    p = price(items, ctx)
    if not p["within_budget"]:
        out.append({"level": "warn", "day": None, "item_id": None,
                    "text": f"Estimated {fmt_inr(p['total'])} is {fmt_inr(p['over_by'])} over your budget. Tap Optimise to fix."})
    return out


# ---------------------------------------------------------------- alternatives (Compare)
def slot_window(items, item, ctx) -> tuple[int, int]:
    start, end = day_window(ctx, item["day"], items)
    sid = (item.get("meta") or {}).get("split")
    for o in items:
        if not live(o) or o is item or o.get("id") == item.get("id") or o["day"] != item["day"] or o["kind"] not in ("activity", "transport", "rest"):
            continue
        if sid and (o.get("meta") or {}).get("split") == sid:
            continue
        if o["end_min"] <= item["start_min"]:
            start = max(start, o["end_min"] + (45 if o["kind"] == "transport" else 15))
        elif o["start_min"] >= item["end_min"]:
            end = min(end, o["start_min"] - 15)
    return start, end


def fit_in_window(o, start, end, prefer=None):
    st = max(start, hm(o["open"]))
    if prefer is not None:
        st = max(st, min(prefer, end - o["duration_min"]))
        st = max(st, hm(o["open"]), start)
    en = st + o["duration_min"]
    if en > min(end, hm(o["close"])):
        return None
    return st, en


def activity_alternatives(items, item, ctx, limit=6, indoor_only=False, exclude=()) -> list:
    dest = dest_for_day(ctx, item["day"])
    start, end = slot_window(items, item, ctx)
    used = {i["offering_id"] for i in items if live(i) and i["kind"] == "activity"}
    who = item_members(item, ctx)
    out = []
    for o in acts_in(dest):
        if o["id"] in used or o["id"] in exclude or act_allowed(o, ctx, item["day"], members=who):
            continue
        if indoor_only and o["indoor_outdoor"] == "outdoor":
            continue
        f = fit_in_window(o, start, end, prefer=item["start_min"])
        if not f:
            continue
        delta = o["price"] * len(who) - (item["price"] if live(item) else 0)
        ev = evaluate(o, ctx, item["day"], f[0], who)
        out.append({"offering": o, "start_min": f[0], "end_min": f[1], "price": o["price"] * len(who), "members": who,
                    "delta": delta, "score": act_score(o, ctx, item["day"], f[0], who), "fit": ev["fit_eligible"],
                    "member_fits": ev["members"], "crowd": ev["crowd"], "reason": fit_reason(o, ctx, f[0], f[1], delta, ev["fit_eligible"])})
    out.sort(key=lambda a: -a["score"])
    return out[:limit]


def hotel_alternatives(item, ctx) -> list:
    out = []
    for h in hotels_in(item["dest_key"]):
        if h["id"] == item["offering_id"] or not h["available"]:
            continue
        p = h["price"] * item["qty"] * item["nights"]
        out.append({"offering": h, "price": p, "delta": p - item["price"], "score": h["rating"],
                    "reason": f"{h['tier'].title()} · {h['rating']:.1f}★ · {', '.join(h['amenities'][:3])}"})
    return out


def transport_alternatives(items, item, ctx) -> list:
    out = []
    for m in ("car", "train", "flight"):
        if m == item["meta"].get("mode"):
            continue
        q = transport_quote(m, item["from_key"], item["dest_key"], ctx, item["start_min"])
        if not q:
            continue
        later = q["arrive"] - item["end_min"]
        clash = [i for i in items if live(i) and i["kind"] == "activity" and i["day"] == item["day"]
                 and item["meta"].get("phase") != "depart" and i["start_min"] < q["arrive"] + 45]
        reason = f"{dur_label(q['duration'])} door to door · arrives {label(q['arrive'])}"
        if clash:
            reason += f" · clashes with {len(clash)} activit{'y' if len(clash) == 1 else 'ies'}"
        out.append({"offering": off(q["offering_id"]), "quote": q, "price": q["price"], "delta": q["price"] - item["price"],
                    "score": -q["duration"], "reason": reason, "arrive_change": later, "clashes": [c.get("id") for c in clash]})
    return out


def free_slot(items, day, o, ctx) -> tuple[int, int] | None:
    """Earliest window on `day` where activity o fits without moving anything else."""
    start, end = day_window(ctx, day, items)
    if hm(o["close"]) - o["duration_min"] < start and not any(i["kind"] == "transport" and i["day"] == day and live(i) for i in items):
        start = max(hm(o["open"]), start - 180)  # sunrise-only experience
    cur = start
    for bs, be in blocks(items, day) + [(end + 15, end + 15)]:
        f = fit_in_window(o, cur, bs - 15)
        if f and f[1] <= end:
            return f
        cur = max(cur, be + 15)
    return None
