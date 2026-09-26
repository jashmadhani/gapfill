"""TourCraft API. Run: uvicorn app.main:app --reload --port 8000"""
import json
import os
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import func, inspect as sa_inspect, select
from sqlalchemy.ext.asyncio import AsyncSession

from . import assist, customize
from . import planner as P
from .adapt import resolve_event, run_trigger
from .catalog import INTERESTS, PACES, TIERS
from .db import SessionLocal, backend_name, engine, get_db
from .models import (ChangeEvent, ChatMessage, Coordinator, Customer, Offering, Payment, Review, Task, Tour, TourItem,
                     Vendor)
from .seed import reset_and_seed
from .services import (book_tour, ctx_for, current_day, get_state, item_dict, load_items, payments_summary, ser_item,
                       ser_offering, serialize_tour, stage)


# ---------------------------------------------------------------- websocket hub
class Hub:
    def __init__(self):
        self.clients: set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.clients.add(ws)

    def drop(self, ws: WebSocket):
        self.clients.discard(ws)

    async def broadcast(self, msg: dict):
        data = json.dumps(msg, default=str)
        for ws in list(self.clients):
            try:
                await ws.send_text(data)
            except Exception:
                self.drop(ws)


hub = Hub()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.connect() as conn:
        has = await conn.run_sync(lambda c: sa_inspect(c).has_table("app_state"))
    if not has:
        await reset_and_seed()
    async with SessionLocal() as db:
        await P.load_world(db)
    yield


app = FastAPI(title="TourCraft API", version="1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def llm_mode():
    return "anthropic" if os.environ.get("ANTHROPIC_API_KEY") else "rules"


async def tour_or_404(db, tour_id) -> Tour:
    t = await db.get(Tour, tour_id)
    if not t:
        raise HTTPException(404, "Tour not found")
    return t


async def ser_event(db, e: ChangeEvent) -> dict:
    tour = await db.get(Tour, e.tour_id)
    return {"id": e.id, "tour_id": e.tour_id, "tour_code": tour.code if tour else None, "tour_title": tour.title if tour else None,
            "trigger_type": e.trigger_type, "label": e.label, "reason": e.reason,
            "impact": {k: v for k, v in (e.impact or {}).items() if k != "prev_status"},
            "options": [{k: v for k, v in o.items() if k != "changes"} for o in e.options], "status": e.status, "chosen": e.chosen,
            "source": e.source, "resolved_by": e.resolved_by, "created_at": e.created_at.isoformat(),
            "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None}


async def after_events(db, events):
    for e in events:
        await hub.broadcast({"type": "change", "tour_id": e.tour_id, "event": await ser_event(db, e)})


async def tour_changed(tour_id, **extra):
    await hub.broadcast({"type": "tour_updated", "tour_id": tour_id, **extra})


# ---------------------------------------------------------------- schemas
class PlanIn(BaseModel):
    customer_id: int | None = None
    name: str | None = None
    title: str | None = None
    start_date: date | None = None
    days: int = 6
    destinations: list[str] = Field(default_factory=list)
    start_city: str = "delhi"
    end_city: str | None = None
    adults: int = 2
    children: int = 0
    budget: float = 150000
    hotel_tier: str = "standard"
    transport: str = "best"
    interests: list[str] = Field(default_factory=list)
    pace: str = "balanced"
    needs: dict = Field(default_factory=dict)


class SwapIn(BaseModel):
    offering_id: int | None = None
    mode: str | None = None


class AddIn(BaseModel):
    offering_id: int
    day: int | None = None


class BookIn(BaseModel):
    pay: str = "deposit"  # deposit | full
    method: str = "upi"


class PaymentIn(BaseModel):
    amount: float
    method: str = "upi"
    kind: str = "payment"
    note: str = ""


class TourPatch(BaseModel):
    coordinator_id: int | None = None
    title: str | None = None
    prefs: dict | None = None
    regenerate: bool = False
    status: str | None = None


class TriggerIn(BaseModel):
    trigger_type: str
    tour_id: int | None = None
    item_id: int | None = None
    offering_id: int | None = None
    vendor_id: int | None = None
    dest: str | None = None
    date: str | None = None
    clear: bool = False
    minutes: int | None = None
    new_budget: float | None = None
    source: str = "system"


class ResolveIn(BaseModel):
    action: str  # accept | dismiss
    option: str | None = None
    by: str = "traveler"


class ChatIn(BaseModel):
    text: str


class ReviewIn(BaseModel):
    overall: int
    text: str = ""
    items: list[dict] = Field(default_factory=list)  # [{item_id, rating, text}]


class VendorStatusIn(BaseModel):
    status: str  # open | closed
    offering_id: int | None = None


class VendorBookingIn(BaseModel):
    action: str  # confirm | decline


class ClockIn(BaseModel):
    time: str | None = None
    on_date: date | None = None
    day: int | None = None  # jump to day N of the active tour


class ChecklistIn(BaseModel):
    key: str
    done: bool


# ---------------------------------------------------------------- meta / demo
@app.get("/health")
async def health():
    return {"ok": True, "db": backend_name(), "assistant": llm_mode()}


@app.get("/state")
async def state(db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    tour = await db.get(Tour, st.active_tour_id) if st.active_tour_id else None
    return {"demo_date": st.demo_date.isoformat(), "demo_time": st.demo_time, "active_tour_id": st.active_tour_id,
            "active_day": current_day(tour, st) if tour else None, "rain": st.rain,
            "destinations": [{"key": k, "name": d["name"], "airport": d["airport"], "rail": d["rail"]} for k, d in P.W["dests"].items()],
            "interests": INTERESTS, "tiers": TIERS, "paces": list(PACES), "transport_modes": ["best", "car", "train", "flight"],
            "db": backend_name(), "assistant": llm_mode()}


@app.post("/demo/reset")
async def demo_reset():
    out = await reset_and_seed()
    await hub.broadcast({"type": "demo_reset", **out})
    return out


@app.post("/demo/clock")
async def demo_clock(body: ClockIn, db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    if body.time:
        P.hm(body.time)
        st.demo_time = body.time
    if body.on_date:
        st.demo_date = body.on_date
    if body.day is not None and st.active_tour_id:
        tour = await db.get(Tour, st.active_tour_id)
        st.demo_date = tour.start_date + timedelta(days=body.day - 1)
    await db.commit()
    await hub.broadcast({"type": "clock", "demo_date": st.demo_date.isoformat(), "demo_time": st.demo_time})
    return {"demo_date": st.demo_date.isoformat(), "demo_time": st.demo_time}


# ---------------------------------------------------------------- discover
@app.get("/discover")
async def discover(interests: str = "", db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    ints = [i for i in interests.split(",") if i]
    if not ints and st.active_tour_id:
        tour = await db.get(Tour, st.active_tour_id)
        ints = (tour.prefs or {}).get("interests", [])
    return {"interests": ints, "destinations": P.recommend_destinations(ints),
            "experiences": [ser_offering(o, brief=True) | {"reason": P.fit_reason(o, {"interests": ints})}
                            for o in P.recommend_experiences(ints, limit=12)]}


@app.get("/destinations/{key}")
async def destination(key: str):
    d = P.W["dests"].get(key)
    if not d:
        raise HTTPException(404, "Unknown destination")
    return {**{k: d[k] for k in ("key", "name", "region", "tagline", "description", "tags", "ideal_nights", "airport", "rail", "best_months")},
            "experiences": [ser_offering(o, brief=True) for o in sorted(P.acts_in(key), key=lambda o: -o["rating"])],
            "hotels": [ser_offering(h) for h in P.hotels_in(key)]}


@app.get("/offerings/{oid}")
async def offering(oid: int, db: AsyncSession = Depends(get_db)):
    o = P.off(oid)
    if not o:
        raise HTTPException(404, "Unknown offering")
    reviews = (await db.execute(select(Review).where(Review.offering_id == oid).order_by(Review.created_at.desc()).limit(6))).scalars().all()
    return ser_offering(o) | {"reviews": [{"author": r.author, "rating": r.rating, "text": r.text,
                                           "days_ago": (datetime.utcnow() - r.created_at).days} for r in reviews]}


# ---------------------------------------------------------------- tours (traveler + operator)
@app.post("/tours/plan")
async def plan_tour(body: PlanIn, db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    if body.customer_id:
        cust = await db.get(Customer, body.customer_id)
    else:
        cust = Customer(name=body.name or "Guest traveler", segment="family" if body.children else "couple" if body.adults == 2 else "solo" if body.adults == 1 else "friends",
                        interests=body.interests)
        db.add(cust)
        await db.flush()
    prefs = body.model_dump(exclude={"customer_id", "name", "title", "start_date"})
    start = body.start_date or (st.demo_date + timedelta(days=21))
    res = P.plan(prefs, start, st.rain)
    count = (await db.execute(select(func.count(Tour.id)))).scalar() or 0
    names = [P.W["dests"][s["dest"]]["name"] for s in res["route"]]
    tour = Tour(code=f"TC-{2601 + count}", title=body.title or f"{' · '.join(names)} — {res['ctx']['days']} days", customer_id=cust.id,
                start_date=start, days=res["ctx"]["days"], prefs={**prefs, "days": res["ctx"]["days"]}, route=res["route"],
                group={"name": cust.name, "adults": body.adults, "children": body.children,
                       "members": [cust.name.split(" ")[0]] + [f"Guest {k + 2}" for k in range(body.adults + body.children - 1)]},
                notes=res["warnings"] + res["notes"], checklist={})
    db.add(tour)
    await db.flush()
    from .services import new_row
    for i in res["items"]:
        await new_row(db, tour, i, False)
    st.active_tour_id = tour.id
    await db.commit()
    await hub.broadcast({"type": "tour_created", "tour_id": tour.id})
    return await serialize_tour(db, tour, st)


@app.get("/tours")
async def tours(stage_filter: str | None = None, db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    out = [await serialize_tour(db, t, st, full=False) for t in (await db.execute(select(Tour).order_by(Tour.start_date))).scalars()]
    return [t for t in out if not stage_filter or t["stage"] == stage_filter]


@app.get("/tours/{tour_id}")
async def tour_detail(tour_id: int, db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    return await serialize_tour(db, await tour_or_404(db, tour_id), st)


@app.post("/tours/{tour_id}/activate")
async def activate(tour_id: int, db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    await tour_or_404(db, tour_id)
    st.active_tour_id = tour_id
    await db.commit()
    await tour_changed(tour_id, reason="activated")
    return {"active_tour_id": tour_id}


@app.patch("/tours/{tour_id}")
async def patch_tour(tour_id: int, body: TourPatch, db: AsyncSession = Depends(get_db)):
    tour = await tour_or_404(db, tour_id)
    if body.coordinator_id is not None:
        tour.coordinator_id = body.coordinator_id
    if body.title:
        tour.title = body.title
    if body.status in ("cancelled",):
        tour.status = body.status
    if body.prefs:
        if tour.status != "draft":
            raise HTTPException(400, "Booked tours change through the Adapt flow.")
        tour.prefs = {**tour.prefs, **body.prefs}
    if body.regenerate:
        await customize.regenerate(db, tour)
    await db.commit()
    await tour_changed(tour_id)
    return await serialize_tour(db, tour, await get_state(db))


@app.get("/tours/{tour_id}/items/{item_id}/alternatives")
async def alternatives(tour_id: int, item_id: int, db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    tour = await tour_or_404(db, tour_id)
    items = [item_dict(r) for r in await load_items(db, tour_id)]
    it = next((i for i in items if i["id"] == item_id), None)
    if not it:
        raise HTTPException(404, "Unknown item")
    ctx = ctx_for(tour, st)
    if it["kind"] == "activity":
        alts = P.activity_alternatives(items, it, ctx, limit=8)
    elif it["kind"] == "hotel":
        alts = P.hotel_alternatives(it, ctx)
    else:
        alts = P.transport_alternatives(items, it, ctx)
    cur = P.off(it["offering_id"])
    return {"item": ser_item(tour, it, st), "current": ser_offering(cur, brief=True),
            "alternatives": [{"offering": ser_offering(a["offering"], brief=True), "price": a["price"], "delta": a["delta"],
                              "delta_gross": round(P.gross(a["delta"])), "reason": a["reason"], "score": a["score"],
                              "start_label": P.label(a["start_min"]) if "start_min" in a else None,
                              "end_label": P.label(a["end_min"]) if "end_min" in a else None,
                              "mode": a.get("quote", {}).get("mode"), "arrive_label": P.label(a["quote"]["arrive"]) if a.get("quote") else None,
                              "duration_min": a["quote"]["duration"] if a.get("quote") else None, "clashes": a.get("clashes", [])}
                             for a in alts]}


async def _custom(db, tour_id, fn):
    tour = await tour_or_404(db, tour_id)
    try:
        out = await fn(tour)
    except customize.CustomizeError as e:
        raise HTTPException(400, str(e))
    await db.commit()
    await tour_changed(tour_id)
    return {"result": out, "tour": await serialize_tour(db, tour, await get_state(db))}


@app.post("/tours/{tour_id}/items/{item_id}/swap")
async def swap_item(tour_id: int, item_id: int, body: SwapIn, db: AsyncSession = Depends(get_db)):
    return await _custom(db, tour_id, lambda t: customize.swap(db, t, item_id, body.offering_id, body.mode))


@app.delete("/tours/{tour_id}/items/{item_id}")
async def remove_item(tour_id: int, item_id: int, db: AsyncSession = Depends(get_db)):
    return await _custom(db, tour_id, lambda t: customize.remove(db, t, item_id))


@app.post("/tours/{tour_id}/items")
async def add_item(tour_id: int, body: AddIn, db: AsyncSession = Depends(get_db)):
    return await _custom(db, tour_id, lambda t: customize.add(db, t, body.offering_id, body.day))


@app.post("/tours/{tour_id}/optimise")
async def optimise(tour_id: int, db: AsyncSession = Depends(get_db)):
    return await _custom(db, tour_id, lambda t: customize.optimise(db, t))


@app.post("/tours/{tour_id}/book")
async def book(tour_id: int, body: BookIn, db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    tour = await tour_or_404(db, tour_id)
    if tour.status != "draft":
        raise HTTPException(400, "Tour is already booked.")
    items = [item_dict(r) for r in await load_items(db, tour_id)]
    errors = [c for c in P.conflicts(items, ctx_for(tour, st)) if c["level"] == "error"]
    if errors:
        raise HTTPException(400, "Fix these first: " + " ".join(e["text"] for e in errors[:3]))
    out = await book_tour(db, tour, body.pay, body.method)
    db.add(ChatMessage(tour_id=tour.id, role="assistant", text=f"🎉 {tour.title} is booked! I'll keep an eye on every connection and warn you early if anything is at risk."))
    await db.commit()
    await tour_changed(tour_id, reason="booked")
    await hub.broadcast({"type": "bookings", "tour_id": tour_id})
    return out | {"tour": await serialize_tour(db, tour, st)}


@app.post("/tours/{tour_id}/payments")
async def pay(tour_id: int, body: PaymentIn, db: AsyncSession = Depends(get_db)):
    await tour_or_404(db, tour_id)
    db.add(Payment(tour_id=tour_id, amount=body.amount, method=body.method, kind=body.kind, note=body.note or ("Refund" if body.kind == "refund" else "Payment")))
    await db.commit()
    await tour_changed(tour_id, reason="payment")
    return {"ok": True}


@app.post("/tours/{tour_id}/checklist")
async def check(tour_id: int, body: ChecklistIn, db: AsyncSession = Depends(get_db)):
    tour = await tour_or_404(db, tour_id)
    tour.checklist = {**(tour.checklist or {}), body.key: body.done}
    await db.commit()
    return {"ok": True}


@app.post("/tours/{tour_id}/review")
async def review(tour_id: int, body: ReviewIn, db: AsyncSession = Depends(get_db)):
    tour = await tour_or_404(db, tour_id)
    cust = await db.get(Customer, tour.customer_id)
    for r in body.items:
        row = await db.get(TourItem, r["item_id"])
        if row and row.tour_id == tour_id and row.offering_id and r.get("rating"):
            row.rating = int(r["rating"])
            db.add(Review(offering_id=row.offering_id, tour_id=tour_id, author=cust.name.split(" ")[0], rating=int(r["rating"]), text=r.get("text", "")))
    tour.review = {"overall": body.overall, "text": body.text, "at": datetime.utcnow().isoformat()}
    tour.status = "reviewed"
    await db.commit()
    await P.load_world(db)
    await tour_changed(tour_id, reason="reviewed")
    return {"ok": True}


# ---------------------------------------------------------------- adapt
@app.post("/changes/trigger")
async def trigger(body: TriggerIn, db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    events, note = await run_trigger(db, body.model_dump(), st.active_tour_id)
    await db.commit()
    await P.load_world(db)
    await after_events(db, events)
    await hub.broadcast({"type": "world", "trigger": body.trigger_type})
    return {"events": [await ser_event(db, e) for e in events], "note": note}


@app.get("/changes")
async def changes(tour_id: int | None = None, status: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(ChangeEvent).order_by(ChangeEvent.created_at.desc())
    if tour_id:
        q = q.where(ChangeEvent.tour_id == tour_id)
    if status:
        q = q.where(ChangeEvent.status == status)
    return [await ser_event(db, e) for e in (await db.execute(q)).scalars()]


@app.get("/changes/{eid}")
async def change(eid: int, db: AsyncSession = Depends(get_db)):
    e = await db.get(ChangeEvent, eid)
    if not e:
        raise HTTPException(404, "Unknown change")
    return await ser_event(db, e)


@app.post("/changes/{eid}/resolve")
async def resolve(eid: int, body: ResolveIn, db: AsyncSession = Depends(get_db)):
    e = await db.get(ChangeEvent, eid)
    if not e:
        raise HTTPException(404, "Unknown change")
    if e.status != "pending":
        raise HTTPException(409, f"Already {e.status} by {e.resolved_by}.")
    try:
        out = await resolve_event(db, e, body.action, body.option, body.by)
    except ValueError as err:
        raise HTTPException(400, str(err))
    await db.commit()
    await hub.broadcast({"type": "change_resolved", "tour_id": e.tour_id, "event_id": e.id, "action": body.action, "by": body.by,
                         "option": e.chosen})
    await tour_changed(e.tour_id, reason="change")
    return out | {"event": await ser_event(db, e)}


# ---------------------------------------------------------------- assist
@app.get("/tours/{tour_id}/chat")
async def chat_history(tour_id: int, db: AsyncSession = Depends(get_db)):
    msgs = (await db.execute(select(ChatMessage).where(ChatMessage.tour_id == tour_id).order_by(ChatMessage.created_at, ChatMessage.id))).scalars().all()
    return [{"id": m.id, "role": m.role, "text": m.text, "data": m.data, "at": m.created_at.isoformat()} for m in msgs]


@app.post("/tours/{tour_id}/chat")
async def chat(tour_id: int, body: ChatIn, db: AsyncSession = Depends(get_db)):
    tour = await tour_or_404(db, tour_id)
    db.add(ChatMessage(tour_id=tour_id, role="user", text=body.text))
    try:
        reply, data = await assist.handle(db, tour, body.text)
    except customize.CustomizeError as e:
        reply, data = str(e), {}
    m = ChatMessage(tour_id=tour_id, role="assistant", text=reply, data=data)
    db.add(m)
    await db.commit()
    evs = [await db.get(ChangeEvent, i) for i in data.get("events", [])]
    await after_events(db, [e for e in evs if e])
    await tour_changed(tour_id, reason="chat")
    return {"reply": reply, "data": data}


# ---------------------------------------------------------------- vendors
@app.get("/vendors")
async def vendors(kind: str | None = None, db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(TourItem).where(TourItem.vendor_id.is_not(None), TourItem.status.in_(["booked", "disrupted"])))).scalars().all()
    out = []
    for v in P.W["vendors"].values():
        if kind and v["kind"] != kind:
            continue
        mine = [r for r in rows if r.vendor_id == v["id"]]
        offs = [o for o in P.W["offerings"].values() if o["vendor_id"] == v["id"]]
        out.append({**{k: v[k] for k in ("id", "name", "kind", "dest_key", "phone", "status", "commission_pct")},
                    "dest_name": P.W["dests"].get(v["dest_key"], {}).get("name") if v["dest_key"] else "All routes",
                    "offerings": len(offs), "rating": round(sum(o["rating"] for o in offs) / len(offs), 2) if offs else None,
                    "bookings": len(mine), "pending": sum(1 for r in mine if r.vendor_status == "pending"),
                    "revenue": sum(r.price for r in mine)})
    return sorted(out, key=lambda v: (-v["bookings"], v["name"]))


@app.get("/vendors/{vid}")
async def vendor(vid: int, db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    v = P.W["vendors"].get(vid)
    if not v:
        raise HTTPException(404, "Unknown vendor")
    rows = (await db.execute(select(TourItem).where(TourItem.vendor_id == vid).order_by(TourItem.id.desc()))).scalars().all()
    tours = {t.id: t for t in (await db.execute(select(Tour))).scalars()}
    custs = {c.id: c for c in (await db.execute(select(Customer))).scalars()}
    bookings = []
    for r in rows:
        t = tours.get(r.tour_id)
        if not t or not r.booking_ref:
            continue
        i = ser_item(t, item_dict(r), st)
        bookings.append(i | {"tour_code": t.code, "customer": custs[t.customer_id].name, "travelers": (t.group or {}).get("adults", 0) + (t.group or {}).get("children", 0)})
    tasks = (await db.execute(select(Task).where(Task.vendor_id == vid).order_by(Task.created_at.desc()).limit(20))).scalars().all()
    return {**v, "dest_name": P.W["dests"].get(v["dest_key"], {}).get("name") if v["dest_key"] else "All routes",
            "offerings": [ser_offering(o) for o in P.W["offerings"].values() if o["vendor_id"] == vid],
            "requests": [b for b in bookings if b["vendor_status"] == "pending" and b["status"] in ("booked", "disrupted") and not b["is_past"]],
            "upcoming": [b for b in bookings if b["vendor_status"] == "confirmed" and b["status"] in ("booked", "disrupted") and not b["is_past"]],
            "cancelled": [b for b in bookings if b["status"] in ("replaced", "cancelled")][:8],
            "notifications": [{"id": t.id, "kind": t.kind, "text": t.text, "status": t.status, "at": t.created_at.isoformat()} for t in tasks],
            "stats": {"bookings": sum(1 for b in bookings if b["status"] in ("booked", "disrupted")),
                      "revenue": sum(b["price"] for b in bookings if b["status"] in ("booked", "disrupted")),
                      "rating": round(sum(o["rating"] for o in P.W["offerings"].values() if o["vendor_id"] == vid) / max(1, sum(1 for o in P.W["offerings"].values() if o["vendor_id"] == vid)), 2)}}


@app.patch("/vendors/{vid}/status")
async def vendor_status(vid: int, body: VendorStatusIn, db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    events, note = [], None
    if body.status in ("closed", "full"):
        payload = {"trigger_type": "unavailable", "source": "vendor"} | ({"offering_id": body.offering_id} if body.offering_id else {"vendor_id": vid})
        events, note = await run_trigger(db, payload, st.active_tour_id)
        if body.offering_id and body.status == "full":
            (await db.get(Offering, body.offering_id)).status = "full"
    else:
        v = await db.get(Vendor, vid)
        v.status = "open"
        q = select(Offering).where(Offering.vendor_id == vid)
        if body.offering_id:
            q = q.where(Offering.id == body.offering_id)
        for o in (await db.execute(q)).scalars():
            o.status = "open"
    await db.commit()
    await P.load_world(db)
    await after_events(db, events)
    await hub.broadcast({"type": "vendor_status", "vendor_id": vid, "status": body.status})
    return {"events": len(events), "note": note}


@app.post("/vendors/{vid}/bookings/{item_id}")
async def vendor_booking(vid: int, item_id: int, body: VendorBookingIn, db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    r = await db.get(TourItem, item_id)
    if not r or r.vendor_id != vid:
        raise HTTPException(404, "Unknown booking")
    events = []
    if body.action == "confirm":
        r.vendor_status = "confirmed"
        for t in (await db.execute(select(Task).where(Task.vendor_id == vid, Task.status == "open"))).scalars():
            if r.booking_ref and r.booking_ref in t.text:
                t.status = "done"
    else:
        events, _ = await run_trigger(db, {"trigger_type": "vendor_declined", "item_id": item_id, "source": "vendor"}, st.active_tour_id)
    await db.commit()
    await after_events(db, events)
    await tour_changed(r.tour_id, reason="vendor")
    await hub.broadcast({"type": "vendor_status", "vendor_id": vid})
    return {"ok": True, "events": len(events)}


# ---------------------------------------------------------------- operator
@app.get("/operator/dashboard")
async def dashboard(db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    tours = list((await db.execute(select(Tour))).scalars())
    sers = [await serialize_tour(db, t, st, full=False) for t in tours]
    booked = [s for s in sers if s["status"] in ("booked", "reviewed")]
    pipeline = {k: sum(1 for s in sers if s["stage"] == k) for k in ("plan", "prepare", "operate", "complete", "review")}
    items = (await db.execute(select(TourItem).where(TourItem.status.in_(["booked", "disrupted"])))).scalars().all()
    dest_nights: dict = {}
    for t in tours:
        if t.status == "draft":
            continue
        for s in t.route or []:
            dest_nights[s["dest"]] = dest_nights.get(s["dest"], 0) + s["nights"]
    interests: dict = {}
    for t in tours:
        for i in (t.prefs or {}).get("interests", []):
            interests[i] = interests.get(i, 0) + 1
    by_kind = {k: sum(r.price for r in items if r.kind == k) for k in ("hotel", "transport", "activity")}
    vendor_use: dict = {}
    for r in items:
        if r.vendor_id:
            vendor_use[r.vendor_id] = vendor_use.get(r.vendor_id, 0) + 1
    pending = (await db.execute(select(ChangeEvent).where(ChangeEvent.status == "pending").order_by(ChangeEvent.created_at.desc()))).scalars().all()
    resolved = (await db.execute(select(ChangeEvent).where(ChangeEvent.status != "pending"))).scalars().all()
    open_tasks = (await db.execute(select(func.count(Task.id)).where(Task.status == "open"))).scalar()
    alerts = []
    for t in tours:
        if t.status != "booked":
            continue
        full = await serialize_tour(db, t, st)
        for r in full["risks"]:
            alerts.append({**r, "tour_id": t.id, "tour_code": t.code, "customer": full["customer"]["name"]})
    reviews = [t.review["overall"] for t in tours if t.review]
    today_ops = sum(1 for s in sers if s["stage"] == "operate")
    return {
        "kpis": {"active_tours": today_ops, "travelers_on_tour": sum(s["travelers"] for s in sers if s["stage"] == "operate"),
                 "upcoming": pipeline["prepare"], "drafts": pipeline["plan"],
                 "revenue": sum(s["pricing"]["total"] for s in booked), "collected": sum(s["payments"]["net_paid"] for s in booked),
                 "outstanding": sum(max(0, s["payments"]["balance"]) for s in booked if s["status"] == "booked"),
                 "margin": sum(s["pricing"]["service_fee"] for s in booked),
                 "pending_confirmations": sum(s["confirmations"]["pending"] for s in sers),
                 "open_changes": len(pending), "open_tasks": open_tasks, "avg_rating": round(sum(reviews) / len(reviews), 1) if reviews else None,
                 "changes_resolved": len(resolved)},
        "pipeline": pipeline, "alerts": alerts[:12],
        "pending_changes": [await ser_event(db, e) for e in pending[:8]],
        "analytics": {
            "revenue_mix": by_kind,
            "destinations": sorted([{"key": k, "name": P.W["dests"][k]["name"], "nights": n} for k, n in dest_nights.items()], key=lambda x: -x["nights"]),
            "interests": sorted([{"tag": k, "count": v} for k, v in interests.items()], key=lambda x: -x["count"]),
            "top_vendors": sorted([{"id": k, "name": P.W["vendors"][k]["name"], "kind": P.W["vendors"][k]["kind"], "bookings": v}
                                   for k, v in vendor_use.items()], key=lambda x: -x["bookings"])[:6],
        },
        "tours": sorted(sers, key=lambda s: ["operate", "prepare", "plan", "complete", "review", "cancelled"].index(s["stage"])),
        "demo_date": st.demo_date.isoformat(), "demo_time": st.demo_time,
    }


@app.get("/operator/schedule")
async def schedule(day: date | None = None, db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    day = day or st.demo_date
    out = []
    for t in (await db.execute(select(Tour).where(Tour.status == "booked"))).scalars():
        d = (day - t.start_date).days + 1
        if not 1 <= d <= t.days:
            continue
        cust = await db.get(Customer, t.customer_id)
        coord = await db.get(Coordinator, t.coordinator_id) if t.coordinator_id else None
        rows = [item_dict(r) for r in await load_items(db, t.id)]
        ctx = ctx_for(t, st)
        items = [ser_item(t, i, st) for i in rows if i["day"] == d and P.live(i) and i["kind"] != "fee"]
        stay = next((i for i in rows if i["kind"] == "hotel" and P.live(i) and i["day"] <= d < i["day"] + i["nights"]), None)
        out.append({"tour_id": t.id, "code": t.code, "title": t.title, "customer": cust.name, "day": d, "days": t.days,
                    "dest": P.W["dests"][P.dest_for_day(ctx, d)]["name"], "travelers": ctx["travelers"],
                    "coordinator": coord.name if coord else None, "stay": stay["title"] if stay else None,
                    "rain": P.rain_on(ctx, P.dest_for_day(ctx, d), d), "items": items})
    return {"date": day.isoformat(), "now": st.demo_time, "tours": out}


@app.get("/operator/people")
async def people(db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    tours = list((await db.execute(select(Tour))).scalars())
    sers = {t.id: await serialize_tour(db, t, st, full=False) for t in tours}
    customers = []
    for c in (await db.execute(select(Customer))).scalars():
        mine = [sers[t.id] for t in tours if t.customer_id == c.id]
        if not mine:
            continue
        customers.append({"id": c.id, "name": c.name, "email": c.email, "phone": c.phone, "city": c.city, "segment": c.segment,
                          "interests": c.interests, "tours": [{"id": s["id"], "code": s["code"], "title": s["title"], "stage": s["stage"]} for s in mine],
                          "lifetime_value": sum(s["pricing"]["total"] for s in mine if s["status"] != "draft")})
    coords = []
    for c in (await db.execute(select(Coordinator))).scalars():
        mine = [sers[t.id] for t in tours if t.coordinator_id == c.id and t.status == "booked"]
        open_tasks = (await db.execute(select(func.count(Task.id)).where(Task.coordinator_id == c.id, Task.status == "open"))).scalar()
        coords.append({"id": c.id, "name": c.name, "phone": c.phone, "base": P.W["dests"][c.base]["name"], "languages": c.languages,
                       "tours": [{"id": s["id"], "code": s["code"], "title": s["title"], "stage": s["stage"]} for s in mine],
                       "on_tour_now": sum(1 for s in mine if s["stage"] == "operate"), "open_tasks": open_tasks})
    groups = [{"tour_id": s["id"], "code": s["code"], "title": s["title"], "stage": s["stage"], **(s["group"] or {})} for s in sers.values()]
    return {"customers": customers, "coordinators": coords, "groups": groups}


@app.get("/operator/payments")
async def payments(db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    tours = {t.id: t for t in (await db.execute(select(Tour))).scalars()}
    ps = (await db.execute(select(Payment).order_by(Payment.created_at.desc()))).scalars().all()
    summary = []
    for t in tours.values():
        if t.status == "draft":
            continue
        s = await serialize_tour(db, t, st, full=False)
        summary.append({"tour_id": t.id, "code": t.code, "title": t.title, "customer": s["customer"]["name"], "stage": s["stage"],
                        "total": s["pricing"]["total"], **{k: s["payments"][k] for k in ("net_paid", "balance", "status")}})
    return {"ledger": [{"id": p.id, "tour_id": p.tour_id, "code": tours[p.tour_id].code, "amount": p.amount, "kind": p.kind,
                        "method": p.method, "note": p.note, "at": p.created_at.isoformat()} for p in ps],
            "tours": sorted(summary, key=lambda x: -x["balance"])}


@app.get("/operator/tasks")
async def tasks(status: str = "open", db: AsyncSession = Depends(get_db)):
    ts = (await db.execute(select(Task).where(Task.status == status).order_by(Task.created_at.desc()).limit(80))).scalars().all()
    tours = {t.id: t for t in (await db.execute(select(Tour))).scalars()}
    return [{"id": t.id, "kind": t.kind, "text": t.text, "status": t.status, "tour_id": t.tour_id,
             "tour_code": tours[t.tour_id].code if t.tour_id in tours else None, "vendor_id": t.vendor_id,
             "vendor_name": (P.W["vendors"].get(t.vendor_id) or {}).get("name"), "at": t.created_at.isoformat()} for t in ts]


@app.post("/operator/tasks/{task_id}/done")
async def task_done(task_id: int, db: AsyncSession = Depends(get_db)):
    t = await db.get(Task, task_id)
    if not t:
        raise HTTPException(404, "Unknown task")
    t.status = "done"
    # completing a vendor confirmation task confirms the booking it names
    if t.kind == "confirm" and t.tour_id:
        for r in await load_items(db, t.tour_id):
            if r.booking_ref and r.booking_ref in t.text and r.vendor_status == "pending":
                r.vendor_status = "confirmed"
    await db.commit()
    await tour_changed(t.tour_id or 0, reason="task")
    return {"ok": True}


@app.get("/coordinators")
async def coordinators(db: AsyncSession = Depends(get_db)):
    return [{"id": c.id, "name": c.name, "base": c.base} for c in (await db.execute(select(Coordinator))).scalars()]


# ---------------------------------------------------------------- live channel
@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await hub.connect(websocket)
    try:
        await websocket.send_text(json.dumps({"type": "hello"}))
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        hub.drop(websocket)
    except Exception:
        hub.drop(websocket)
