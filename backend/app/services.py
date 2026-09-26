"""Persistence + domain services: tour loading/serialisation, lifecycle stage, booking, payments, tasks,
cancellation policy, proactive risks and the pre-trip checklist."""
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from . import planner as P
from .models import AppState, ChangeEvent, Coordinator, Customer, Payment, Task, Tour, TourItem

DEPOSIT = 0.30
STAGES = ["discover", "personalize", "plan", "price", "book", "prepare", "operate", "assist", "adapt", "complete", "review"]


async def get_state(db: AsyncSession) -> AppState:
    st = await db.get(AppState, 1)
    if not st:
        st = AppState(id=1, demo_date=date.today(), demo_time="11:30", rain=[])
        db.add(st)
        await db.flush()
    return st


def now_dt(st: AppState) -> datetime:
    return datetime.combine(st.demo_date, datetime.min.time()) + timedelta(minutes=P.hm(st.demo_time))


def item_dict(r: TourItem) -> dict:
    return {c.name: getattr(r, c.name) for c in TourItem.__table__.columns} | {"meta": dict(r.meta or {})}


async def load_items(db, tour_id) -> list[TourItem]:
    return list((await db.execute(select(TourItem).where(TourItem.tour_id == tour_id).order_by(TourItem.day, TourItem.start_min, TourItem.id))).scalars())


def ctx_for(tour: Tour, st: AppState) -> dict:
    return P.make_ctx(tour.prefs or {}, tour.start_date, tour.days, tour.route or [], st.rain or [])


def end_date(tour: Tour) -> date:
    return tour.start_date + timedelta(days=tour.days - 1)


def current_day(tour: Tour, st: AppState) -> int | None:
    d = (st.demo_date - tour.start_date).days + 1
    return d if 1 <= d <= tour.days else None


def stage(tour: Tour, st: AppState) -> str:
    if tour.status == "reviewed":
        return "review"
    if tour.status == "cancelled":
        return "cancelled"
    if tour.status == "draft":
        return "plan"
    if st.demo_date < tour.start_date:
        return "prepare"
    if st.demo_date <= end_date(tour):
        return "operate"
    return "complete"


def item_start_dt(tour: Tour, i) -> datetime:
    day = i["day"] if isinstance(i, dict) else i.day
    mins = i["start_min"] if isinstance(i, dict) else i.start_min
    return datetime.combine(tour.start_date + timedelta(days=day - 1), datetime.min.time()) + timedelta(minutes=mins)


def is_past(tour: Tour, i: dict, st: AppState) -> bool:
    end = item_start_dt(tour, i) + timedelta(minutes=(i["end_min"] - i["start_min"]) if i["kind"] != "hotel" else 0)
    if i["kind"] == "hotel":
        end = item_start_dt(tour, i) + timedelta(days=i["nights"])
    return end <= now_dt(st)


def booking_ref(tour: Tour, row: TourItem) -> str:
    prefix = {"hotel": "H", "transport": "T", "activity": "A"}.get(row.kind, "X")
    return f"{prefix}{tour.id:02d}-{row.id:04d}"


# ---------------------------------------------------------------- cancellation policy
def policy_text(i: dict) -> str:
    if i["kind"] == "activity":
        return "Free cancellation up to 24h before; 50% charged after."
    if i["kind"] == "hotel":
        return "Free cancellation up to 72h before check-in; one night charged after."
    mode = (i.get("meta") or {}).get("mode")
    if mode == "flight":
        return "Airline change fee ₹3,000 per traveler."
    if mode == "train":
        return "10% clerkage; 25% within 24h of departure."
    return "Free up to 24h before pickup; 25% after."


def cancel_fee(tour: Tour, i: dict, st: AppState, cause: str) -> float:
    """What the traveler pays when a booked component is cancelled. Only traveler-caused changes are charged —
    vendor failures, weather and transport disruptions are waived under the operator's disruption cover."""
    if cause != "traveler" or i.get("status") not in ("booked", "disrupted"):
        return 0
    hours = (item_start_dt(tour, i) - now_dt(st)).total_seconds() / 3600
    mode = (i.get("meta") or {}).get("mode")
    if i["kind"] == "activity":
        return 0 if hours > 24 else round(i["price"] * 0.5)
    if i["kind"] == "hotel":
        return 0 if hours > 72 else round(i["unit_price"] * i["qty"])
    if mode == "flight":
        return 3000 * i["qty"]
    if mode == "train":
        return round(i["price"] * (0.25 if hours < 24 else 0.10))
    return 0 if hours > 24 else round(i["price"] * 0.25)


# ---------------------------------------------------------------- tasks + payments
async def add_task(db, kind, text, tour_id=None, vendor_id=None, coordinator_id=None):
    t = Task(kind=kind, text=text, tour_id=tour_id, vendor_id=vendor_id, coordinator_id=coordinator_id)
    db.add(t)
    return t


async def payments_summary(db, tour: Tour, total: float) -> dict:
    ps = list((await db.execute(select(Payment).where(Payment.tour_id == tour.id).order_by(Payment.created_at))).scalars())
    paid = sum(p.amount for p in ps if p.kind == "payment")
    refunded = sum(p.amount for p in ps if p.kind == "refund")
    net = paid - refunded
    return {"paid": paid, "refunded": refunded, "net_paid": net, "balance": round(total - net),
            "deposit": round(total * DEPOSIT), "status": "paid" if net >= total - 1 else "deposit" if net > 0 else "unpaid",
            "ledger": [{"id": p.id, "amount": p.amount, "kind": p.kind, "method": p.method, "note": p.note,
                        "at": p.created_at.isoformat()} for p in ps]}


# ---------------------------------------------------------------- item mutations (used by customise + adapt)
async def new_row(db, tour: Tour, d: dict, booked: bool) -> TourItem:
    row = TourItem(tour_id=tour.id, **{k: d[k] for k in ("day", "kind", "offering_id", "vendor_id", "title", "dest_key",
                                                            "from_key", "start_min", "end_min", "nights", "qty", "unit_price", "price")},
                   meta=d.get("meta") or {}, status="booked" if booked else "planned")
    db.add(row)
    await db.flush()
    if booked:
        row.booking_ref = booking_ref(tour, row)
        row.vendor_status = "pending"
        await add_task(db, "confirm", f"Confirm {row.booking_ref}: {row.title} · day {row.day} {P.label(row.start_min)} · {row.qty} pax",
                       tour.id, row.vendor_id, tour.coordinator_id)
    return row


async def retire_row(db, tour: Tour, row: TourItem, st: AppState, cause: str, status="replaced", note="") -> float:
    d = item_dict(row)
    fee = cancel_fee(tour, d, st, cause)
    was_booked = row.status in ("booked", "disrupted") or row.booking_ref
    row.status = status
    row.meta = {**(row.meta or {}), "retired_note": note, "fee": fee}
    if fee:
        db.add(TourItem(tour_id=tour.id, day=row.day, kind="fee", title=f"Cancellation fee · {row.title}", dest_key=row.dest_key,
                        start_min=row.start_min, end_min=row.start_min, price=fee, unit_price=fee, qty=1, status="booked",
                        meta={"for": row.id}))
    if was_booked and row.booking_ref:
        await add_task(db, "cancel", f"Cancel {row.booking_ref}: {row.title}{' — ' + note if note else ''}", tour.id, row.vendor_id, tour.coordinator_id)
    return fee


async def retime_row(db, tour: Tour, row: TourItem, day: int, st_min: int, en_min: int, note=""):
    moved = row.day != day or row.start_min != st_min
    row.day, row.start_min, row.end_min = day, st_min, en_min
    if moved and row.booking_ref:
        row.vendor_status = "pending"
        await add_task(db, "notify", f"Reschedule {row.booking_ref}: {row.title} → day {day} {P.label(st_min)}{' — ' + note if note else ''}",
                       tour.id, row.vendor_id, tour.coordinator_id)


# ---------------------------------------------------------------- risks + checklist
def risks(tour: Tour, items: list, ctx: dict, st: AppState) -> list:
    out = []
    lv = [i for i in items if P.live(i) and not is_past(tour, i, st)]
    horizon = now_dt(st) + timedelta(hours=48)
    for i in lv:
        o = P.off(i["offering_id"]) if i.get("offering_id") else None
        when = item_start_dt(tour, i)
        if i["kind"] == "activity" and o and o["indoor_outdoor"] == "outdoor" and P.rain_on(ctx, i["dest_key"], i["day"]):
            out.append({"level": "high", "item_id": i["id"], "kind": "weather", "text": f"Rain forecast for {i['title']} (day {i['day']}). Tap to see indoor options."})
        if o and not o["available"] and i["kind"] != "fee":
            out.append({"level": "high", "item_id": i["id"], "kind": "unavailable", "text": f"{i['title']} is no longer available."})
        if i.get("vendor_status") == "pending" and when <= horizon and tour.status == "booked":
            out.append({"level": "medium", "item_id": i["id"], "kind": "unconfirmed", "text": f"{i['title']} not yet confirmed by the vendor ({P.label(i['start_min'])}, day {i['day']})."})
        if i.get("vendor_status") == "declined":
            out.append({"level": "high", "item_id": i["id"], "kind": "declined", "text": f"Vendor declined {i['title']}."})
    for d in range(1, tour.days + 1):
        day = sorted([i for i in lv if i["day"] == d and i["kind"] in ("activity", "transport")], key=lambda i: i["start_min"])
        for a, b in zip(day, day[1:]):
            gap = b["start_min"] - a["end_min"]
            if a["kind"] == "transport" and b["kind"] == "activity" and 0 <= gap < 60:
                out.append({"level": "medium", "item_id": b["id"], "kind": "connection",
                            "text": f"Tight connection on day {d}: {gap} min from arrival to {b['title']}. A {60 - gap}+ min delay would miss it."})
        long_leg = next((i for i in day if i["kind"] == "transport" and i["end_min"] - i["start_min"] > 6 * 60), None)
        if long_leg and any(i["kind"] == "activity" and i["start_min"] >= 19 * 60 for i in day):
            out.append({"level": "low", "item_id": long_leg["id"], "kind": "fatigue", "text": f"Day {d} has a {P.dur_label(long_leg['end_min'] - long_leg['start_min'])} transfer and a late activity — consider a lighter evening."})
    return out


def packing_for(tour: Tour) -> list:
    tags = set()
    for s in tour.route or []:
        tags.update(P.W["dests"].get(s["dest"], {}).get("tags", []))
    tips = ["Photo ID for every traveler (hotels and monuments check it)"]
    if "adventure" in tags or "nature" in tags:
        tips.append("Scarf, sunglasses and sunscreen for the desert / safaris")
    if "wildlife" in tags:
        tips.append("Neutral-coloured clothes and a warm layer for early safaris")
    if "spiritual" in tags or "heritage" in tags:
        tips.append("Shoulders-and-knees covered outfit for temples; easy slip-on shoes")
    tips.append("Comfortable walking shoes — forts are steep")
    return tips


def checklist(tour: Tour, pay: dict) -> list:
    done = tour.checklist or {}
    items = [
        ("ids", "Upload ID proofs for all travelers", done.get("ids", False)),
        ("vouchers", "Download vouchers & booking references", done.get("vouchers", False)),
        ("balance", "Pay the balance", pay["balance"] <= 0),
        ("coordinator", "Save your tour coordinator's number", done.get("coordinator", False)),
        ("insurance", "Travel insurance (optional)", done.get("insurance", False)),
        ("packing", "Packing: " + "; ".join(packing_for(tour)), done.get("packing", False)),
    ]
    return [{"key": k, "label": l, "done": bool(v), "auto": k == "balance"} for k, l, v in items]


# ---------------------------------------------------------------- serialisation
def ser_offering(o: dict, brief=False) -> dict:
    if not o:
        return None
    d = {"id": o["id"], "kind": o["kind"], "title": o["title"], "dest_key": o["dest_key"],
         "dest_name": P.W["dests"].get(o["dest_key"], {}).get("name") if o["dest_key"] else None,
         "price": o["price"], "rating": o["rating"], "rating_count": o["rating_count"], "tags": o["tags"],
         "duration_min": o["duration_min"], "indoor_outdoor": o["indoor_outdoor"], "tier": o["tier"], "mode": o["mode"],
         "vendor_id": o["vendor_id"], "vendor_name": o["vendor_name"], "available": o["available"], "status": o["status"],
         "kid_friendly": o["kid_friendly"], "step_free": o["step_free"], "open": o["open"], "close": o["close"],
         "lat": o.get("lat"), "lng": o.get("lng")}
    if not brief:
        d |= {"description": o["description"], "amenities": o["amenities"], "closed_weekdays": o["closed_weekdays"], "capacity": o["capacity"]}
    return d


def ser_item(tour: Tour, i: dict, st: AppState) -> dict:
    o = P.off(i["offering_id"]) if i.get("offering_id") else None
    d = {k: i[k] for k in ("id", "day", "kind", "offering_id", "vendor_id", "title", "dest_key", "from_key", "start_min",
                           "end_min", "nights", "qty", "unit_price", "price", "status", "booking_ref", "vendor_status", "rating")}
    d |= {"meta": i["meta"], "start_label": P.label(i["start_min"]), "end_label": P.label(i["end_min"]),
          "date": (tour.start_date + timedelta(days=i["day"] - 1)).isoformat(), "is_past": is_past(tour, i, st),
          "dest_name": P.W["dests"].get(i["dest_key"], {}).get("name") if i.get("dest_key") else None,
          "from_name": P.W["dests"].get(i["from_key"], {}).get("name") if i.get("from_key") else None,
          "offering": ser_offering(o, brief=True), "vendor_name": (P.W["vendors"].get(i["vendor_id"]) or {}).get("name"),
          "policy": policy_text(i) if i["kind"] != "fee" else None}
    return d


async def serialize_tour(db: AsyncSession, tour: Tour, st: AppState, full=True) -> dict:
    rows = await load_items(db, tour.id)
    items = [item_dict(r) for r in rows]
    ctx = ctx_for(tour, st)
    pricing = P.price(items, ctx)
    pay = await payments_summary(db, tour, pricing["total"])
    cust = await db.get(Customer, tour.customer_id)
    coord = await db.get(Coordinator, tour.coordinator_id) if tour.coordinator_id else None
    pending = (await db.execute(select(ChangeEvent).where(ChangeEvent.tour_id == tour.id, ChangeEvent.status == "pending"))).scalars().all()
    base = {
        "id": tour.id, "code": tour.code, "title": tour.title, "status": tour.status, "stage": stage(tour, st),
        "start_date": tour.start_date.isoformat(), "end_date": end_date(tour).isoformat(), "days": tour.days,
        "current_day": current_day(tour, st), "group": tour.group, "prefs": tour.prefs,
        "route": [{**s, "name": P.W["dests"].get(s["dest"], {}).get("name"),
                   "from_date": (tour.start_date + timedelta(days=s["first_day"] - 1)).isoformat()} for s in tour.route or []],
        "customer": {"id": cust.id, "name": cust.name, "email": cust.email, "phone": cust.phone, "city": cust.city, "segment": cust.segment} if cust else None,
        "coordinator": {"id": coord.id, "name": coord.name, "phone": coord.phone, "languages": coord.languages} if coord else None,
        "pricing": pricing, "payments": {k: v for k, v in pay.items() if full or k != "ledger"},
        "pending_changes": len(pending), "travelers": ctx["travelers"],
        "confirmations": {"pending": sum(1 for i in items if P.live(i) and i.get("vendor_status") == "pending"),
                          "confirmed": sum(1 for i in items if P.live(i) and i.get("vendor_status") == "confirmed"),
                          "declined": sum(1 for i in items if P.live(i) and i.get("vendor_status") == "declined")},
        "review": tour.review, "created_at": tour.created_at.isoformat(),
    }
    if not full:
        base["risk_count"] = len(risks(tour, items, ctx, st)) if tour.status == "booked" else 0
        return base
    days = []
    for d in range(1, tour.days + 1):
        dest = P.dest_for_day(ctx, d)
        stay = next((i for i in items if i["kind"] == "hotel" and P.live(i) and i["day"] <= d < i["day"] + i["nights"]), None)
        days.append({"day": d, "date": (tour.start_date + timedelta(days=d - 1)).isoformat(), "dest": dest,
                     "dest_name": P.W["dests"].get(dest, {}).get("name"), "rain": P.rain_on(ctx, dest, d),
                     "stay": {"id": stay["id"], "title": stay["title"], "night": d - stay["day"] + 1, "nights": stay["nights"]} if stay else None,
                     "items": [ser_item(tour, i, st) for i in sorted([i for i in items if i["day"] == d], key=lambda i: (i["start_min"], i["id"]))]})
    tasks = (await db.execute(select(Task).where(Task.tour_id == tour.id).order_by(Task.created_at.desc()))).scalars().all()
    events = (await db.execute(select(ChangeEvent).where(ChangeEvent.tour_id == tour.id).order_by(ChangeEvent.created_at.desc()))).scalars().all()
    base |= {
        "days_detail": days, "notes": tour.notes or [], "conflicts": P.conflicts(items, ctx) if tour.status == "draft" else [],
        "risks": risks(tour, items, ctx, st) if tour.status == "booked" else [],
        "checklist": checklist(tour, pay), "packing": packing_for(tour),
        "tasks": [{"id": t.id, "kind": t.kind, "text": t.text, "status": t.status, "vendor_id": t.vendor_id,
                   "vendor_name": (P.W["vendors"].get(t.vendor_id) or {}).get("name"), "at": t.created_at.isoformat()} for t in tasks],
        "changes": [{"id": e.id, "label": e.label, "reason": e.reason, "status": e.status, "chosen": e.chosen, "source": e.source,
                     "resolved_by": e.resolved_by, "at": e.created_at.isoformat(),
                     "chosen_label": next((o["label"] for o in e.options if o["key"] == e.chosen), None)} for e in events],
    }
    return base


# ---------------------------------------------------------------- booking
async def assign_coordinator(db, tour: Tour) -> Coordinator | None:
    coords = list((await db.execute(select(Coordinator))).scalars())
    if not coords:
        return None
    active = list((await db.execute(select(Tour).where(Tour.status == "booked"))).scalars())
    load = {c.id: sum(1 for t in active if t.coordinator_id == c.id) for c in coords}
    stops = [s["dest"] for s in tour.route or []]
    return min(coords, key=lambda c: (load[c.id] - (1.5 if c.base in stops else 0), c.id))


async def book_tour(db, tour: Tour, pay_mode: str = "deposit", method: str = "upi") -> dict:
    st = await get_state(db)
    rows = await load_items(db, tour.id)
    if not tour.coordinator_id:
        c = await assign_coordinator(db, tour)
        tour.coordinator_id = c.id if c else None
    refs = []
    for r in rows:
        if r.status != "planned":
            continue
        r.status = "booked"
        r.booking_ref = booking_ref(tour, r)
        r.vendor_status = "pending"
        refs.append({"item_id": r.id, "ref": r.booking_ref, "title": r.title, "kind": r.kind, "day": r.day,
                     "vendor": (P.W["vendors"].get(r.vendor_id) or {}).get("name"), "start_label": P.label(r.start_min)})
        await add_task(db, "confirm", f"Confirm {r.booking_ref}: {r.title} · day {r.day} · {r.qty} {'room(s)' if r.kind == 'hotel' else 'pax'}",
                       tour.id, r.vendor_id, tour.coordinator_id)
    tour.status = "booked"
    tour.booked_at = datetime.utcnow()
    total = P.price([item_dict(r) for r in rows], ctx_for(tour, st))["total"]
    amount = total if pay_mode == "full" else round(total * DEPOSIT)
    if amount > 0:
        db.add(Payment(tour_id=tour.id, amount=amount, kind="payment", method=method,
                       note="Full payment" if pay_mode == "full" else "30% deposit"))
    return {"refs": refs, "paid": amount, "total": total}
