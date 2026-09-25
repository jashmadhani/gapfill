"""Stateful services: recommendations for a slot, the disruption/replan engine, demand signals, serialization."""
import random
import string
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .engine import (HEADCOUNT, SlotContext, at, build_slot_context, compose_bundle, evaluate, fmt_clock, hhmm_to_min, is_available,
                     item_location, load_world, occupying, recompute_gaps, serialize_candidate, serialize_ctx,
                     serialize_exp, time_fit, to_min)
from .models import AppState, DemandSignal, DisruptionEvent, Experience, ItineraryItem

TRIGGER_LABELS = {
    "unavailable": "Vendor unavailable", "weather": "Weather turned bad",
    "time_shrink": "Running late", "budget_shrink": "Budget tightened",
}


async def get_state(db: AsyncSession) -> AppState:
    st = await db.get(AppState, 1)
    if not st:
        st = AppState(id=1)
        db.add(st)
        await db.flush()
    return st


def booking_ref() -> str:
    return "GF-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


async def bump_demand(db: AsyncSession, key: str, tag: str, n: int = 1) -> None:
    today = date.today()
    row = (await db.execute(select(DemandSignal).where(
        DemandSignal.vendor_id_or_area == key, DemandSignal.query_tag == tag, DemandSignal.date == today))).scalar_one_or_none()
    if row:
        row.count += n
    else:
        db.add(DemandSignal(vendor_id_or_area=key, query_tag=tag, count=n, date=today))


# ---------------------------------------------------------------- recommendations
async def recommend_for_gap(db: AsyncSession, gap: ItineraryItem) -> dict:
    st = await get_state(db)
    itin, user, sess, items, exps, vendors = await load_world(db, gap.itinerary_id)
    ctx = build_slot_context(itin=itin, user=user, sess=sess, items=items, exp_by_id=exps, weather_bad=st.weather_bad,
                             slot_start=gap.start_time, slot_end=gap.end_time)
    cands, excluded = evaluate(exps, vendors, ctx)
    bundle = compose_bundle(cands, ctx)
    primary = serialize_candidate(cands[0], ctx, vendors) if cands else None
    backups = [serialize_candidate(c, ctx, vendors) for c in cands[1:3]]
    if bundle:
        by_id = {c["exp"].id: c["exp"] for c in cands}
        bundle["experiences"] = [serialize_exp(by_id[i], vendors[by_id[i].vendor_id]) for i in bundle["experience_ids"]]
        for leg in bundle["legs"]:
            leg["start_label"], leg["end_label"] = fmt_clock(leg["start"]), fmt_clock(leg["end"])
        bundle["back_by_label"] = fmt_clock(bundle["back_by"])
    # demand signals: what travelers near this slot are looking for, and vendor impressions
    area = f"area:{ctx.origin.get('key')}"
    for tag in ctx.intent_tags:
        await bump_demand(db, area, tag)
    if cands:
        await bump_demand(db, f"vendor:{cands[0]['exp'].vendor_id}", "shown")
    await db.commit()
    return {"slot_id": gap.id, "slot": serialize_ctx(ctx), "primary": primary, "backups": backups, "bundle": bundle,
            "excluded": excluded, "candidate_count": len(cands), "weather_bad": st.weather_bad}


# ---------------------------------------------------------------- disruption / replan engine
def slot_for_item(item: ItineraryItem, items: list) -> tuple[datetime, datetime]:
    if item.slot_start and item.slot_end:
        return item.slot_start, item.slot_end
    occ = [i for i in occupying(items) if i.id != item.id]
    prev = [i for i in occ if i.end_time <= item.start_time]
    nxt = [i for i in occ if i.start_time >= item.end_time]
    return (prev[-1].end_time if prev else item.start_time), (nxt[0].start_time if nxt else item.end_time)


async def _solve(db: AsyncSession, event: DisruptionEvent, item: ItineraryItem):
    """Re-run the recommendation pipeline against the original slot's (now changed) constraints."""
    st = await get_state(db)
    itin, user, sess, items, exps, vendors = await load_world(db, item.itinerary_id)
    c = event.context
    ctx = build_slot_context(itin=itin, user=user, sess=sess, items=items, exp_by_id=exps,
                             weather_bad=st.weather_bad or c.get("indoor_only", False),
                             slot_start=datetime.fromisoformat(c["slot_start"]), slot_end=datetime.fromisoformat(c["slot_end"]),
                             replacing_item_id=item.id)
    ctx.exclude_ids |= set(c.get("exclude_ids", []))
    cands, excluded = evaluate(exps, vendors, ctx)
    return ctx, cands, excluded, vendors


async def solve_alternatives(db: AsyncSession, event: DisruptionEvent) -> dict:
    item = await db.get(ItineraryItem, event.itinerary_item_id)
    ctx, cands, excluded, vendors = await _solve(db, event, item)
    alts = [serialize_candidate(c, ctx, vendors) for c in cands[:2]]  # exactly 1 primary + 1 backup
    if event.resolution_status == "pending":
        event.alternatives = alts
    return {"primary": alts[0] if alts else None, "backup": alts[1] if len(alts) > 1 else None,
            "slot": serialize_ctx(ctx), "excluded": excluded}


async def create_disruption(db: AsyncSession, item: ItineraryItem, trigger: str, reason: str, *,
                            late_minutes: int = 0, indoor_only: bool = False) -> DisruptionEvent:
    # one live card per item: supersede any older pending event
    for old in (await db.execute(select(DisruptionEvent).where(
            DisruptionEvent.itinerary_item_id == item.id, DisruptionEvent.resolution_status == "pending"))).scalars():
        old.resolution_status = "dismissed"
    items = (await db.execute(select(ItineraryItem).where(ItineraryItem.itinerary_id == item.itinerary_id))).scalars().all()
    s, e = slot_for_item(item, list(items))
    s = s + timedelta(minutes=late_minutes)
    ev = DisruptionEvent(itinerary_item_id=item.id, trigger_type=trigger, created_at=datetime.now(),
                         resolution_status="pending", reason=reason,
                         context={"slot_start": s.isoformat(), "slot_end": e.isoformat(),
                                  "exclude_ids": [item.experience_id] if item.experience_id else [],
                                  "indoor_only": indoor_only, "late_minutes": late_minutes})
    db.add(ev)
    item.status = "disrupted"
    await db.flush()
    await solve_alternatives(db, ev)
    await db.flush()
    return ev


async def active_experience_items(db: AsyncSession, itinerary_id: int) -> list[ItineraryItem]:
    st = await get_state(db)
    now_min = hhmm_to_min(st.demo_now)
    items = (await db.execute(select(ItineraryItem).where(ItineraryItem.itinerary_id == itinerary_id))).scalars().all()
    return [i for i in occupying(list(items)) if i.experience_id and i.status == "confirmed" and to_min(i.end_time) > now_min]


async def scan_unavailable(db: AsyncSession, itinerary_id: int) -> list[DisruptionEvent]:
    _, user, _, _, exps, vendors = await load_world(db, itinerary_id)
    events = []
    for item in await active_experience_items(db, itinerary_id):
        exp = exps[item.experience_id]
        v = vendors[exp.vendor_id]
        if not is_available(exp, v, user.group_type):
            when = fmt_clock(to_min(item.start_time))
            if v.status in ("closed", "full"):
                why = f"{v.name} {'has closed for today' if v.status == 'closed' else 'is fully booked'}, so “{exp.title}” at {when} can't happen."
            elif exp.capacity_left > 0:
                why = f"“{exp.title}” at {when} is down to {exp.capacity_left} spot(s) — not enough for your group."
            else:
                why = f"“{exp.title}” at {when} just sold out."
            events.append(await create_disruption(db, item, "unavailable", f"{why} Here's a swap that fits the same window."))
    return events


async def scan_weather(db: AsyncSession, itinerary_id: int) -> list[DisruptionEvent]:
    _, _, _, _, exps, _ = await load_world(db, itinerary_id)
    events = []
    for item in await active_experience_items(db, itinerary_id):
        exp = exps[item.experience_id]
        if exp.indoor_outdoor == "outdoor":
            events.append(await create_disruption(
                db, item, "weather",
                f"Heavy rain is forecast during “{exp.title}” (outdoors). Here's an indoor option for the same window.",
                indoor_only=True))
    return events


async def trigger_running_late(db: AsyncSession, itinerary_id: int, minutes: int, item_id: int | None) -> dict:
    items = await active_experience_items(db, itinerary_id)
    item = next((i for i in items if i.id == item_id), None) if item_id else (items[0] if items else None)
    if not item:
        return {"events": [], "note": "No upcoming experience to shift."}
    _, _, _, all_items, exps, _ = await load_world(db, itinerary_id)
    exp = exps[item.experience_id]
    s, e = slot_for_item(item, all_items)
    # does the same experience still fit once the window starts later?
    probe = SlotContext(trip_date=s.date(), start=to_min(s) + minutes, end=to_min(e),
                        origin=_prev_loc(item, all_items, exps), dest=_next_loc(item, all_items, exps),
                        budget_left=10**9, group_type="solo", access_flags=[])
    fit = time_fit(exp, probe)
    if fit:
        item.start_time = at(s.date(), fit["start"])
        item.end_time = at(s.date(), fit["end"])
        item.slot_start = s + timedelta(minutes=minutes)
        item.slot_end = e
        await recompute_gaps(db, itinerary_id)
        return {"events": [], "note": f"Still fits — “{exp.title}” shifted to {fmt_clock(fit['start'])}."}
    ev = await create_disruption(
        db, item, "time_shrink",
        f"You're running {minutes} min late, so “{exp.title}” ({exp.duration_min} min) no longer fits before "
        f"{fmt_clock(to_min(e))}. Here's something shorter for the time you have left.",
        late_minutes=minutes)
    return {"events": [ev], "note": None}


def _prev_loc(item, items, exps):
    prev = [i for i in occupying(items) if i.id != item.id and i.end_time <= item.start_time]
    return item_location(prev[-1], exps) if prev else item_location(item, exps)


def _next_loc(item, items, exps):
    nxt = [i for i in occupying(items) if i.id != item.id and i.start_time >= item.end_time]
    return item_location(nxt[0], exps) if nxt else item_location(item, exps)


async def trigger_budget(db: AsyncSession, itinerary_id: int, new_budget: float) -> list[DisruptionEvent]:
    _, _, sess, items, exps, _ = await load_world(db, itinerary_id)
    old = sess.budget_envelope
    sess.budget_envelope = new_budget
    await db.flush()
    upcoming = await active_experience_items(db, itinerary_id)
    price = lambda i: i.price_paid if i.price_paid is not None else exps[i.experience_id].price  # noqa: E731
    spent = sum(price(i) for i in occupying(items) if i.experience_id)
    if spent <= new_budget or not upcoming:
        return []
    item = max(upcoming, key=price)
    exp = exps[item.experience_id]
    return [await create_disruption(
        db, item, "budget_shrink",
        f"Your budget dropped from ₹{old:,.0f} to ₹{new_budget:,.0f}. “{exp.title}” (₹{price(item):,.0f}) now puts you over, "
        f"so here's a cheaper option for the same window.")]


async def resolve(db: AsyncSession, event: DisruptionEvent, action: str, choice: str = "primary") -> dict:
    item = await db.get(ItineraryItem, event.itinerary_item_id)
    result: dict = {"event_id": event.id, "action": action}
    if action == "accept":
        ctx, cands, _, _ = await _solve(db, event, item)
        idx = 1 if choice == "backup" else 0
        if len(cands) <= idx:
            raise ValueError("That alternative is no longer available.")
        c = cands[idx]
        exp: Experience = c["exp"]
        new = ItineraryItem(
            itinerary_id=item.itinerary_id, type="suggested", status="confirmed", experience_id=exp.id, title=exp.title,
            location_key=exp.location.get("key"), start_time=at(ctx.trip_date, c["fit"]["start"]),
            end_time=at(ctx.trip_date, c["fit"]["end"]), slot_start=at(ctx.trip_date, ctx.start),
            slot_end=at(ctx.trip_date, ctx.end), price_paid=exp.price, booking_ref=booking_ref())
        db.add(new)
        item.status = "replaced"
        _, user, *_ = await load_world(db, item.itinerary_id)
        exp.capacity_left = max(0, exp.capacity_left - HEADCOUNT.get(user.group_type, 1))
        event.resolution_status = "accepted"
        await bump_demand(db, f"vendor:{exp.vendor_id}", "booked")
        await db.flush()
        result["new_item_id"] = new.id
        result["booking_ref"] = new.booking_ref
    else:
        event.resolution_status = "dismissed"
        if event.trigger_type == "unavailable":
            item.status = "replaced"  # can't keep it; free the window so a new suggestion appears
        else:
            item.status = "confirmed"  # traveler chose to keep the original plan
            if event.context.get("late_minutes"):
                late = event.context["late_minutes"]
                item.start_time += timedelta(minutes=late)
                item.end_time += timedelta(minutes=late)
    late = event.context.get("late_minutes") or 0
    if late:
        # hold the time the traveler is behind so it doesn't show up as bookable free time
        *_, all_items, exps, _ = await load_world(db, item.itinerary_id)
        s, _ = slot_for_item(item, all_items)
        db.add(ItineraryItem(itinerary_id=item.itinerary_id, type="booked", status="confirmed",
                             title=f"Running {late} min behind", location_key=_prev_loc(item, all_items, exps).get("key"),
                             start_time=s, end_time=s + timedelta(minutes=late)))
        await db.flush()
    await recompute_gaps(db, item.itinerary_id)
    await db.commit()
    return result


# ---------------------------------------------------------------- serialization
async def serialize_event(db: AsyncSession, ev: DisruptionEvent, refresh: bool = True) -> dict:
    item = await db.get(ItineraryItem, ev.itinerary_item_id)
    exp = await db.get(Experience, item.experience_id) if item.experience_id else None
    alts = await solve_alternatives(db, ev) if (refresh and ev.resolution_status == "pending") else {
        "primary": ev.alternatives[0] if ev.alternatives else None,
        "backup": ev.alternatives[1] if len(ev.alternatives or []) > 1 else None}
    return {"id": ev.id, "itinerary_item_id": ev.itinerary_item_id, "trigger_type": ev.trigger_type,
            "trigger_label": TRIGGER_LABELS.get(ev.trigger_type, ev.trigger_type), "reason": ev.reason,
            "created_at": ev.created_at.isoformat(), "resolution_status": ev.resolution_status,
            "original": {"title": item.title, "start_label": fmt_clock(to_min(item.start_time)),
                         "end_label": fmt_clock(to_min(item.end_time)),
                         "experience": serialize_exp(exp) if exp else None},
            **alts}


async def serialize_itinerary(db: AsyncSession, itinerary_id: int) -> dict:
    st = await get_state(db)
    itin, user, sess, items, exps, vendors = await load_world(db, itinerary_id)
    now_min = hhmm_to_min(st.demo_now)
    out_items = []
    for i in sorted(items, key=lambda x: (x.start_time, x.type != "gap")):
        exp = exps.get(i.experience_id) if i.experience_id else None
        out_items.append({
            "id": i.id, "type": i.type, "status": i.status, "title": i.title or (exp.title if exp else "Free time"),
            "start_time": i.start_time.isoformat(), "end_time": i.end_time.isoformat(),
            "start_label": fmt_clock(to_min(i.start_time)), "end_label": fmt_clock(to_min(i.end_time)),
            "minutes": round((i.end_time - i.start_time).total_seconds() / 60),
            "location": item_location(i, exps) if i.type != "gap" else None,
            "experience": serialize_exp(exp, vendors.get(exp.vendor_id)) if exp else None,
            "booking_ref": i.booking_ref, "price_paid": i.price_paid,
            "is_past": to_min(i.end_time) <= now_min,
        })
    gaps = [x for x in out_items if x["type"] == "gap" and not x["is_past"]]
    pending = (await db.execute(select(DisruptionEvent).join(ItineraryItem, ItineraryItem.id == DisruptionEvent.itinerary_item_id)
                                .where(ItineraryItem.itinerary_id == itinerary_id, DisruptionEvent.resolution_status == "pending")
                                .order_by(DisruptionEvent.id.desc()))).scalars().all()
    spent = sum((i.price_paid or 0) for i in occupying(items) if i.experience_id)
    return {
        "id": itin.id, "trip_date": itin.trip_date.isoformat(),
        "user": {"id": user.id, "display_name": user.display_name, "group_type": user.group_type,
                 "accessibility_flags": user.accessibility_flags, "home_currency": user.home_currency},
        "session": {"id": sess.id, "budget_envelope": sess.budget_envelope, "location": sess.location,
                    "intent_raw_text": sess.intent_raw_text, "intent_parsed_json": sess.intent_parsed_json} if sess else None,
        "spent": spent, "items": out_items, "next_gap_id": gaps[0]["id"] if gaps else None,
        "weather_bad": st.weather_bad, "demo_now": st.demo_now,
        "pending_disruption_ids": [e.id for e in pending],
    }
