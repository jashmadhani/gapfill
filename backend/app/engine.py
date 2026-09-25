"""Core algorithms: trust score, gap detection, time-fit, filters, ranking, bundle composer."""
import math
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Experience, Itinerary, ItineraryItem, Review, Session, TravelTime, User, Vendor
from .seed_data import LOCATIONS, SAME_PLACE_MINUTES

GAP_MIN_MINUTES = 45
TRUST_LAMBDA = math.log(2) / 90  # recency weight halves every 90 days
HEADCOUNT = {"solo": 1, "couple": 2, "family": 4, "large_group": 8}
ACCESS_FLAGS = ["step_free", "seating_available", "restroom_onsite", "sensory_friendly"]


# ---------------------------------------------------------------- time helpers
def to_min(dt: datetime) -> int:
    return dt.hour * 60 + dt.minute


def hhmm_to_min(s: str) -> int:
    h, m = s.split(":")
    return int(h) * 60 + int(m)


def at(d: date, minutes: float) -> datetime:
    return datetime.combine(d, time(0, 0)) + timedelta(minutes=round(minutes))


def fmt_clock(minutes: float) -> str:
    minutes = round(minutes)
    h, m = divmod(minutes, 60)
    suffix = "AM" if h < 12 else "PM"
    h12 = h % 12 or 12
    return f"{h12}:{m:02d} {suffix}"


def fmt_span(minutes: float) -> str:
    minutes = round(minutes)
    h, m = divmod(minutes, 60)
    if h and m:
        return f"{h}h {m}m"
    return f"{h} hr{'s' if h > 1 else ''}" if h else f"{m} min"


# ---------------------------------------------------------------- travel lookup (static, cached)
_TRAVEL: dict[tuple[str, str], int] = {}


async def load_travel_table(db: AsyncSession) -> None:
    _TRAVEL.clear()
    for row in (await db.execute(select(TravelTime))).scalars():
        _TRAVEL[(row.from_key, row.to_key)] = row.minutes


def _haversine_minutes(a: dict, b: dict) -> int:
    r = 6371
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dp, dl = p2 - p1, math.radians(b["lng"] - a["lng"])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    km = 2 * r * math.asin(math.sqrt(h)) * 1.3
    return int(round(5 + km / 20 * 60))


def loc_of(key: str | None) -> dict:
    if key and key in LOCATIONS:
        name, lat, lng = LOCATIONS[key]
        return {"key": key, "name": name, "lat": lat, "lng": lng}
    return {"key": key, "name": key or "Unknown", "lat": LOCATIONS["mi_road"][1], "lng": LOCATIONS["mi_road"][2]}


def travel(a: dict, b: dict) -> int:
    ka, kb = a.get("key"), b.get("key")
    if ka and ka == kb:
        return SAME_PLACE_MINUTES
    if (ka, kb) in _TRAVEL:
        return _TRAVEL[(ka, kb)]
    # Listings created after seeding may sit outside the lookup table: estimate from coordinates.
    return _haversine_minutes(a, b)


# ---------------------------------------------------------------- trust score (precomputed + cached on Experience)
def compute_trust(reviews: list[Review], now: datetime) -> tuple[float, dict]:
    if not reviews:
        return 3.5, {"count": 0, "recent_90d": 0, "plain_avg": None, "summary": "New listing, no reviews yet"}
    num = den = 0.0
    recent = 0
    for r in reviews:
        days = max(0.0, (now - r.created_at).total_seconds() / 86400)
        w = math.exp(-TRUST_LAMBDA * days)
        num += r.rating * w
        den += w
        recent += days <= 90
    score = num / den
    plain = sum(r.rating for r in reviews) / len(reviews)
    summary = f"{score:.1f}/5 from {len(reviews)} reviews, {recent} in the last 90 days"
    if plain - score >= 0.4:
        summary += " — recent reviews are weaker than older ones"
    elif score - plain >= 0.3:
        summary += " — trending up recently"
    return round(score, 2), {"count": len(reviews), "recent_90d": recent, "plain_avg": round(plain, 2), "summary": summary}


async def refresh_trust(db: AsyncSession, experience_id: int | None = None) -> None:
    now = datetime.now()
    q = select(Experience)
    if experience_id:
        q = q.where(Experience.id == experience_id)
    for exp in (await db.execute(q)).scalars().all():
        reviews = (await db.execute(select(Review).where(Review.experience_id == exp.id))).scalars().all()
        score, meta = compute_trust(list(reviews), now)
        seed_key = (exp.trust_meta or {}).get("seed_key")
        exp.trust_score, exp.trust_meta = score, {**meta, "seed_key": seed_key}
    await db.flush()


# ---------------------------------------------------------------- gap detection
def occupying(items: list[ItineraryItem]) -> list[ItineraryItem]:
    return sorted([i for i in items if i.type != "gap" and i.status != "replaced"], key=lambda i: (i.start_time, i.end_time))


async def recompute_gaps(db: AsyncSession, itinerary_id: int) -> list[ItineraryItem]:
    """Rebuild gap items between consecutive occupying items. Gaps with an unchanged span keep their id."""
    items = (await db.execute(select(ItineraryItem).where(ItineraryItem.itinerary_id == itinerary_id))).scalars().all()
    existing = {(g.start_time, g.end_time): g for g in items if g.type == "gap"}
    occ = occupying(list(items))
    wanted = []
    for a, b in zip(occ, occ[1:]):
        if (b.start_time - a.end_time).total_seconds() / 60 >= GAP_MIN_MINUTES:
            wanted.append((a.end_time, b.start_time))
    keep_ids = set()
    for span in wanted:
        if span in existing:
            keep_ids.add(existing[span].id)
        else:
            g = ItineraryItem(itinerary_id=itinerary_id, type="gap", start_time=span[0], end_time=span[1],
                              status="pending", title="Free time")
            db.add(g)
    stale = [g.id for g in existing.values() if g.id not in keep_ids]
    if stale:
        await db.execute(delete(ItineraryItem).where(ItineraryItem.id.in_(stale)))
    await db.flush()
    return (await db.execute(select(ItineraryItem).where(ItineraryItem.itinerary_id == itinerary_id))).scalars().all()


# ---------------------------------------------------------------- slot context
@dataclass
class SlotContext:
    trip_date: date
    start: float
    end: float
    origin: dict
    dest: dict
    budget_left: float
    group_type: str
    access_flags: list
    indoor_only: bool = False
    exclude_ids: set = field(default_factory=set)
    intent_tags: list = field(default_factory=list)
    max_price: float | None = None
    max_duration: int | None = None

    @property
    def length(self) -> float:
        return self.end - self.start

    @property
    def buffer(self) -> float:
        return max(10.0, 0.15 * self.length)


def item_location(item: ItineraryItem, exp_by_id: dict) -> dict:
    if item.experience_id and item.experience_id in exp_by_id:
        return exp_by_id[item.experience_id].location
    return loc_of(item.location_key)


async def load_world(db: AsyncSession, itinerary_id: int):
    itin = await db.get(Itinerary, itinerary_id)
    user = await db.get(User, itin.user_id)
    sess = await db.get(Session, itin.session_id) if itin.session_id else None
    items = (await db.execute(select(ItineraryItem).where(ItineraryItem.itinerary_id == itinerary_id))).scalars().all()
    exps = (await db.execute(select(Experience))).scalars().all()
    vendors = (await db.execute(select(Vendor))).scalars().all()
    return itin, user, sess, list(items), {e.id: e for e in exps}, {v.id: v for v in vendors}


def spent_excluding(items: list[ItineraryItem], exp_by_id: dict, skip_item_id: int | None) -> float:
    total = 0.0
    for i in occupying(items):
        if i.id == skip_item_id or not i.experience_id:
            continue
        total += i.price_paid if i.price_paid is not None else exp_by_id[i.experience_id].price
    return total


def build_slot_context(*, itin, user, sess, items, exp_by_id, weather_bad: bool,
                       slot_start: datetime, slot_end: datetime, replacing_item_id: int | None = None) -> SlotContext:
    """Constraints for an idle window: neighbours for travel, remaining budget, traveler filters, intent."""
    occ = [i for i in occupying(items) if i.id != replacing_item_id]
    prev = [i for i in occ if i.end_time <= slot_start]
    nxt = [i for i in occ if i.start_time >= slot_end]
    home = (sess.location if sess else None) or loc_of("hotel")
    origin = item_location(prev[-1], exp_by_id) if prev else home
    dest = item_location(nxt[0], exp_by_id) if nxt else home
    budget = sess.budget_envelope if sess else 3000
    intent = (sess.intent_parsed_json or {}) if sess else {}
    in_plan = {i.experience_id for i in occ if i.experience_id}
    return SlotContext(
        trip_date=itin.trip_date, start=to_min(slot_start), end=to_min(slot_end), origin=origin, dest=dest,
        budget_left=max(0.0, budget - spent_excluding(items, exp_by_id, replacing_item_id)),
        group_type=user.group_type, access_flags=list(user.accessibility_flags or []),
        indoor_only=weather_bad or bool(intent.get("indoor_only")), exclude_ids=in_plan,
        intent_tags=list(intent.get("tags", [])), max_price=intent.get("max_price"),
        max_duration=intent.get("max_duration"),
    )


# ---------------------------------------------------------------- filters + fit
def is_available(exp: Experience, vendor: Vendor, group_type: str) -> bool:
    return vendor.status == "open" and exp.capacity_left >= HEADCOUNT.get(group_type, 1)


def time_fit(exp: Experience, ctx: SlotContext) -> dict | None:
    """Hard filter: travel_to + duration + travel_back + buffer <= slot length, inside opening hours."""
    t_to, t_back = travel(ctx.origin, exp.location), travel(exp.location, ctx.dest)
    need = t_to + exp.duration_min + t_back + ctx.buffer
    if need > ctx.length:
        return None
    start = ctx.start + t_to
    oh = exp.opening_hours or {}
    if oh.get("open"):
        start = max(start, hhmm_to_min(oh["open"]))  # arrive early and wait for opening if needed
    end = start + exp.duration_min
    if oh.get("close") and end > hhmm_to_min(oh["close"]):
        return None
    back_by = end + t_back
    if back_by + ctx.buffer > ctx.end:
        return None
    return {"travel_to": t_to, "travel_back": t_back, "buffer": round(ctx.buffer), "start": start, "end": end,
            "back_by": back_by, "slack": round(ctx.end - back_by)}


def relevance(exp: Experience, ctx: SlotContext) -> float:
    overlap = len(set(exp.category_tags) & set(ctx.intent_tags))
    return 1.0 + 0.3 * min(overlap, 3)


def fit_reasoning(exp: Experience, fit: dict, ctx: SlotContext) -> str:
    comfy = fit["slack"] >= fit["buffer"] + 15
    lead = "Fits comfortably in" if comfy else "Fits in"
    parts = [f"{lead} your {fmt_span(ctx.length)} window — back at {ctx.dest['name']} by {fmt_clock(fit['back_by'])}"
             f" with {fmt_span(fit['slack'])} to spare."]
    parts.append(f"{fit['travel_to']} min from {ctx.origin['name']}, starts {fmt_clock(fit['start'])}.")
    parts.append(f"₹{exp.price:,.0f} of your ₹{ctx.budget_left:,.0f} remaining budget.")
    return " ".join(parts)


def evaluate(exps: dict, vendors: dict, ctx: SlotContext):
    """Run every hard filter; return scored candidates plus counts of why others were excluded."""
    excluded = {"unavailable": 0, "group": 0, "accessibility": 0, "weather": 0, "time": 0, "budget": 0, "intent": 0, "in_plan": 0}
    cands = []
    for exp in exps.values():
        if exp.id in ctx.exclude_ids:
            excluded["in_plan"] += 1
            continue
        if not is_available(exp, vendors[exp.vendor_id], ctx.group_type):
            excluded["unavailable"] += 1
            continue
        if ctx.group_type not in (exp.group_suitability or []):
            excluded["group"] += 1
            continue
        attrs = exp.accessibility_attributes or {}
        if any(not attrs.get(f) for f in ctx.access_flags):
            excluded["accessibility"] += 1
            continue
        if ctx.indoor_only and exp.indoor_outdoor != "indoor":
            excluded["weather"] += 1
            continue
        if ctx.max_duration and exp.duration_min > ctx.max_duration:
            excluded["intent"] += 1
            continue
        fit = time_fit(exp, ctx)
        if not fit:
            excluded["time"] += 1
            continue
        cap = ctx.budget_left if ctx.max_price is None else min(ctx.budget_left, ctx.max_price)
        if exp.price > cap:
            excluded["budget"] += 1
            continue
        rel = relevance(exp, ctx)
        cands.append({"exp": exp, "fit": fit, "relevance": rel, "score": round(exp.trust_score * rel, 3)})
    cands.sort(key=lambda c: (-c["score"], c["fit"]["travel_to"] + c["fit"]["travel_back"]))
    return cands, excluded


def compose_bundle(cands: list, ctx: SlotContext, max_items: int = 3) -> dict | None:
    """Greedy by (trust*relevance)/price; keep adding while budget and the chained route still fit the slot."""
    ordered = sorted(cands, key=lambda c: -(c["score"] / max(c["exp"].price, 1.0)))
    chosen, total = [], 0.0
    for c in ordered:
        if len(chosen) >= max_items:
            break
        if total + c["exp"].price > ctx.budget_left:
            continue
        trial = chosen + [c["exp"]]
        plan = _route(trial, ctx)
        if plan:
            chosen, total = trial, total + c["exp"].price
    if len(chosen) < 2:
        return None
    plan = _route(chosen, ctx)
    return {"experience_ids": [e.id for e in chosen], "total_price": total, "legs": plan,
            "back_by": plan[-1]["back_by"], "total_minutes": round(plan[-1]["back_by"] - ctx.start)}


def _route(exps: list, ctx: SlotContext) -> list | None:
    cursor, here, legs = ctx.start, ctx.origin, []
    for e in exps:
        t = travel(here, e.location)
        start = cursor + t
        oh = e.opening_hours or {}
        if oh.get("open"):
            start = max(start, hhmm_to_min(oh["open"]))
        end = start + e.duration_min
        if oh.get("close") and end > hhmm_to_min(oh["close"]):
            return None
        legs.append({"experience_id": e.id, "travel_to": t, "start": start, "end": end})
        cursor, here = end, e.location
    back = travel(here, ctx.dest)
    legs[-1]["travel_back"] = back
    legs[-1]["back_by"] = cursor + back
    if cursor + back + ctx.buffer > ctx.end:
        return None
    return legs


def serialize_exp(exp: Experience, vendor: Vendor | None = None) -> dict:
    d = {
        "id": exp.id, "vendor_id": exp.vendor_id, "title": exp.title, "description": exp.description,
        "category_tags": exp.category_tags, "price": exp.price, "duration_min": exp.duration_min,
        "location": exp.location, "accessibility_attributes": exp.accessibility_attributes,
        "group_suitability": exp.group_suitability, "opening_hours": exp.opening_hours,
        "indoor_outdoor": exp.indoor_outdoor, "capacity_left": exp.capacity_left,
        "trust_score": exp.trust_score, "trust_meta": exp.trust_meta,
    }
    if vendor:
        d["vendor"] = {"id": vendor.id, "name": vendor.name, "status": vendor.status}
    return d


def serialize_candidate(c: dict, ctx: SlotContext, vendors: dict) -> dict:
    exp = c["exp"]
    fit = dict(c["fit"])
    fit.update({"start_label": fmt_clock(fit["start"]), "end_label": fmt_clock(fit["end"]),
                "back_by_label": fmt_clock(fit["back_by"]), "reasoning": fit_reasoning(exp, c["fit"], ctx)})
    return {"experience": serialize_exp(exp, vendors.get(exp.vendor_id)), "fit": fit,
            "score": c["score"], "relevance": c["relevance"]}


def serialize_ctx(ctx: SlotContext) -> dict:
    return {"start": fmt_clock(ctx.start), "end": fmt_clock(ctx.end), "length_min": round(ctx.length),
            "length_label": fmt_span(ctx.length), "origin": ctx.origin, "dest": ctx.dest,
            "budget_left": ctx.budget_left, "buffer_min": round(ctx.buffer), "indoor_only": ctx.indoor_only,
            "group_type": ctx.group_type, "access_flags": ctx.access_flags, "intent_tags": ctx.intent_tags}
