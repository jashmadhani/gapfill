"""Traveler-driven customisation: swap / add / remove components, re-optimise to budget, regenerate.
Drafts are edited in place; booked tours go through rebooking with vendor tasks and the cancellation policy."""
from sqlalchemy import delete

from . import planner as P
from .models import Tour, TourItem
from .services import ctx_for, get_state, item_dict, load_items, new_row, retire_row


class CustomizeError(Exception):
    pass


async def _ctx_items(db, tour):
    st = await get_state(db)
    rows = await load_items(db, tour.id)
    return st, ctx_for(tour, st), rows, [item_dict(r) for r in rows]


async def swap(db, tour: Tour, item_id: int, offering_id: int | None = None, mode: str | None = None) -> dict:
    st, ctx, rows, items = await _ctx_items(db, tour)
    row = next((r for r in rows if r.id == item_id), None)
    if not row or not P.live(item_dict(row)):
        raise CustomizeError("That item is no longer in the plan.")
    it = item_dict(row)
    if row.kind == "activity":
        alt = next((a for a in P.activity_alternatives(items, it, ctx, limit=50) if a["offering"]["id"] == offering_id), None)
        o = P.off(offering_id)
        if not alt:
            slot = P.free_slot([i for i in items if i["id"] != item_id], row.day, o, ctx) if o else None
            if not slot:
                raise CustomizeError(f"{o['title'] if o else 'That experience'} doesn't fit day {row.day}'s window.")
            new = P.activity_item(o, row.day, slot[0], ctx)
        else:
            new = P.activity_item(alt["offering"], row.day, alt["start_min"], ctx)
    elif row.kind == "hotel":
        h = P.off(offering_id)
        if not h or h["kind"] != "hotel":
            raise CustomizeError("Pick a hotel.")
        new = P.hotel_item(h, row.day, row.nights, ctx, row.start_min)
    elif row.kind == "transport":
        q = P.transport_quote(mode or "car", row.from_key, row.dest_key, ctx, row.start_min)
        if not q:
            raise CustomizeError(f"No {mode} option on this route.")
        new = P.transport_item(q, row.day, row.from_key, row.dest_key, it["meta"].get("phase", "between"))
    else:
        raise CustomizeError("This item can't be swapped.")
    booked = tour.status == "booked"
    fee = 0
    if booked:
        fee = await retire_row(db, tour, row, st, "traveler", "replaced", "traveler swap")
    else:
        await db.delete(row)
    nr = await new_row(db, tour, new, booked)
    return {"item_id": nr.id, "title": nr.title, "fee": fee, "booking_ref": nr.booking_ref}


async def add(db, tour: Tour, offering_id: int, day: int | None = None) -> dict:
    st, ctx, rows, items = await _ctx_items(db, tour)
    o = P.off(offering_id)
    if not o or o["kind"] != "activity":
        raise CustomizeError("Unknown experience.")
    if any(i["offering_id"] == offering_id and P.live(i) for i in items):
        raise CustomizeError(f"{o['title']} is already in your tour.")
    days = [day] if day else list(range(1, tour.days + 1))
    cur = (st.demo_date - tour.start_date).days + 1
    if tour.status == "booked":
        days = [d for d in days if d >= max(1, cur)]
    reasons = []
    for d in days:
        if P.dest_for_day(ctx, d) != o["dest_key"]:
            reasons.append(f"day {d} is in {P.W['dests'][P.dest_for_day(ctx, d)]['name']}")
            continue
        why = P.act_allowed(o, ctx, d)
        if why:
            reasons.append(f"day {d}: {why}")
            continue
        slot = P.free_slot(items, d, o, ctx)
        if not slot:
            reasons.append(f"day {d} is full")
            continue
        nr = await new_row(db, tour, P.activity_item(o, d, slot[0], ctx), tour.status == "booked")
        return {"item_id": nr.id, "day": d, "start_label": P.label(slot[0]), "title": o["title"], "booking_ref": nr.booking_ref}
    if not day and all("is in" in r for r in reasons):
        raise CustomizeError(f"{o['title']} is in {P.W['dests'][o['dest_key']]['name']}, which isn't on your route.")
    raise CustomizeError(f"Couldn't fit {o['title']}: " + "; ".join(reasons[:3]) + ".")


async def remove(db, tour: Tour, item_id: int) -> dict:
    st = await get_state(db)
    row = await db.get(TourItem, item_id)
    if not row or row.tour_id != tour.id:
        raise CustomizeError("Unknown item.")
    if row.kind in ("hotel", "transport") and tour.status == "draft":
        raise CustomizeError("Stays and transfers hold the route together — swap them instead of removing.")
    if tour.status == "booked":
        fee = await retire_row(db, tour, row, st, "traveler", "cancelled", "traveler removed")
        return {"fee": fee}
    await db.delete(row)
    return {"fee": 0}


async def optimise(db, tour: Tour) -> list:
    st, ctx, rows, items = await _ctx_items(db, tour)
    if tour.status != "draft":
        raise CustomizeError("Booked tours are re-optimised through a budget change.")
    notes = P.optimise(items, ctx)
    by_id = {r.id: r for r in rows}
    for i in items:
        r = by_id[i["id"]]
        if i.get("status") == "cancelled":
            await db.delete(r)
            continue
        for k in ("offering_id", "vendor_id", "title", "start_min", "end_min", "qty", "unit_price", "price", "meta"):
            setattr(r, k, i[k])
    tour.notes = notes or ["Already within budget — nothing to change."]
    return tour.notes


async def regenerate(db, tour: Tour) -> dict:
    st = await get_state(db)
    res = P.plan(tour.prefs, tour.start_date, st.rain)
    await db.execute(delete(TourItem).where(TourItem.tour_id == tour.id))
    tour.route = res["route"]
    tour.days = res["ctx"]["days"]
    tour.notes = res["warnings"] + res["notes"]
    for i in res["items"]:
        await new_row(db, tour, i, False)
    return res
