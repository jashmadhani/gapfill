"""GapFill API. Run: uvicorn app.main:app --reload --port 8000"""
import asyncio
import json
from contextlib import asynccontextmanager
from datetime import date, datetime

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import inspect as sa_inspect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from . import nlp
from .db import SessionLocal, backend_name, engine, get_db
from .engine import (ACCESS_FLAGS, HEADCOUNT, _route, at, build_slot_context, hhmm_to_min, load_travel_table,
                     load_world, loc_of, recompute_gaps, refresh_trust, serialize_exp)
from .models import (Bundle, DemandSignal, DisruptionEvent, Experience, Itinerary, ItineraryItem, Review, Session,
                     User, Vendor)
from .seed import create_sample_itinerary, reset_and_seed
from .seed_data import LOCATIONS
from .services import (booking_ref, bump_demand, get_state, recommend_for_gap, resolve, scan_unavailable,
                       scan_weather, serialize_event, serialize_itinerary, trigger_budget, trigger_running_late)


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
        has_tables = await conn.run_sync(lambda c: sa_inspect(c).has_table("app_state"))
    if not has_tables:
        await reset_and_seed()
    async with SessionLocal() as db:
        await load_travel_table(db)
    yield


app = FastAPI(title="GapFill API", version="1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


async def notify_itinerary(itinerary_id: int, **extra):
    await hub.broadcast({"type": "itinerary_updated", "itinerary_id": itinerary_id, **extra})


async def notify_events(db: AsyncSession, events: list):
    for ev in events:
        await hub.broadcast({"type": "disruption", "event": await serialize_event(db, ev, refresh=False)})


async def active_itinerary_id(db: AsyncSession) -> int:
    st = await get_state(db)
    if not st.active_itinerary_id:
        raise HTTPException(404, "No active itinerary. Start a session first.")
    return st.active_itinerary_id


# ---------------------------------------------------------------- schemas
class SessionStartIn(BaseModel):
    user_id: int | None = None
    display_name: str | None = None
    location_key: str | None = "hotel"
    lat: float | None = None
    lng: float | None = None
    trip_date: date | None = None
    group_type: str = "couple"
    accessibility_flags: list[str] = Field(default_factory=list)
    budget_envelope: float = 3000
    time_window_start: str = "07:00"
    time_window_end: str = "22:00"


class IntentIn(BaseModel):
    session_id: int | None = None
    text: str


class ItineraryIn(BaseModel):
    user_id: int | None = None
    session_id: int | None = None
    trip_date: date | None = None
    source: str = "sample"  # sample | fresh


class ItemIn(BaseModel):
    type: str = "booked"
    title: str | None = None
    start_time: str | None = None  # "HH:MM"
    end_time: str | None = None
    location_key: str | None = None
    experience_id: int | None = None


class ItemsIn(BaseModel):
    slot_id: int | None = None
    experience_ids: list[int] = Field(default_factory=list)  # placed into slot_id in order (single or bundle)
    items: list[ItemIn] = Field(default_factory=list)  # raw items, e.g. a new booked commitment


class TriggerIn(BaseModel):
    trigger_type: str  # unavailable | weather | time_shrink | budget_shrink
    itinerary_id: int | None = None
    experience_id: int | None = None
    vendor_id: int | None = None
    itinerary_item_id: int | None = None
    minutes: int = 45
    new_budget: float | None = None
    weather_bad: bool | None = None


class ResolveIn(BaseModel):
    action: str  # accept | dismiss
    choice: str = "primary"  # primary | backup


class OnboardIn(BaseModel):
    vendor_id: int | None = None
    questions: list[str] = Field(default_factory=list)
    answers: list[str]


class PublishIn(BaseModel):
    vendor_id: int | None = None
    vendor_name: str | None = None
    draft: dict


class VendorStatusIn(BaseModel):
    status: str  # open | closed | full | slots
    slots_left: int | None = None
    experience_id: int | None = None


class BookingIn(BaseModel):
    itinerary_item_ids: list[int]


class ClockIn(BaseModel):
    demo_now: str


class ReviewIn(BaseModel):
    rating: int
    text: str = ""


# ---------------------------------------------------------------- meta / demo
@app.get("/health")
async def health():
    return {"ok": True, "db": backend_name(), "llm": "anthropic" if nlp.os.environ.get("ANTHROPIC_API_KEY") and nlp.LLM_MODEL else "rules-fallback"}


@app.get("/state")
async def state(db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    return {"weather_bad": st.weather_bad, "demo_now": st.demo_now, "active_user_id": st.active_user_id,
            "active_session_id": st.active_session_id, "active_itinerary_id": st.active_itinerary_id,
            "locations": [{"key": k, "name": v[0], "lat": v[1], "lng": v[2]} for k, v in LOCATIONS.items()],
            "access_flags": ACCESS_FLAGS, "group_types": list(HEADCOUNT), "db": backend_name(),
            "llm": "anthropic" if nlp.os.environ.get("ANTHROPIC_API_KEY") and nlp.LLM_MODEL else "rules-fallback"}


@app.post("/demo/reset")
async def demo_reset():
    out = await reset_and_seed()
    await hub.broadcast({"type": "demo_reset", **out})
    return out


@app.post("/demo/clock")
async def demo_clock(body: ClockIn, db: AsyncSession = Depends(get_db)):
    hhmm_to_min(body.demo_now)
    st = await get_state(db)
    st.demo_now = body.demo_now
    await db.commit()
    await notify_itinerary(st.active_itinerary_id or 0, reason="clock")
    return {"demo_now": st.demo_now}


# ---------------------------------------------------------------- session
@app.post("/session/start")
async def session_start(body: SessionStartIn, db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    user = await db.get(User, body.user_id or st.active_user_id or 0)
    if not user:
        user = User(display_name=body.display_name or "Traveler", group_type=body.group_type)
        db.add(user)
    if body.group_type not in HEADCOUNT:
        raise HTTPException(400, f"group_type must be one of {list(HEADCOUNT)}")
    bad = [f for f in body.accessibility_flags if f not in ACCESS_FLAGS]
    if bad:
        raise HTTPException(400, f"unknown accessibility flags {bad}")
    user.group_type = body.group_type
    user.accessibility_flags = body.accessibility_flags
    if body.display_name:
        user.display_name = body.display_name
    await db.flush()
    loc = loc_of(body.location_key or "hotel")
    if body.lat is not None and body.lng is not None:
        loc.update({"lat": body.lat, "lng": body.lng})
    d = body.trip_date or date.today()
    sess = Session(user_id=user.id, location=loc, time_window_start=at(d, hhmm_to_min(body.time_window_start)),
                   time_window_end=at(d, hhmm_to_min(body.time_window_end)), budget_envelope=body.budget_envelope)
    db.add(sess)
    await db.flush()
    st.active_user_id, st.active_session_id = user.id, sess.id
    await db.commit()
    return {"session_id": sess.id, "user_id": user.id, "location": loc, "trip_date": d.isoformat()}


@app.post("/session/intent")
async def session_intent(body: IntentIn, db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    sess = await db.get(Session, body.session_id or st.active_session_id or 0)
    if not sess:
        raise HTTPException(404, "session not found")
    if not body.text.strip():
        sess.intent_raw_text, sess.intent_parsed_json = None, None
        await db.commit()
        return {"parsed": None, "source": "cleared"}
    parsed, source = await nlp.parse_intent(body.text)
    sess.intent_raw_text, sess.intent_parsed_json = body.text, parsed
    for tag in parsed.get("tags", []):
        await bump_demand(db, f"area:{(sess.location or {}).get('key', 'hotel')}", tag)
    await db.commit()
    return {"parsed": parsed, "source": source}


# ---------------------------------------------------------------- itinerary
@app.post("/itinerary")
async def create_itinerary(body: ItineraryIn, db: AsyncSession = Depends(get_db)):
    st = await get_state(db)
    user_id = body.user_id or st.active_user_id
    sess = await db.get(Session, body.session_id or st.active_session_id or 0)
    if not user_id or not sess:
        raise HTTPException(400, "start a session first")
    d = body.trip_date or sess.time_window_start.date()
    if body.source == "sample":
        itin = await create_sample_itinerary(db, user_id, sess.id, d)
    else:
        itin = Itinerary(user_id=user_id, trip_date=d, session_id=sess.id)
        db.add(itin)
        await db.flush()
        # a fresh day is anchored by the session window so the whole day is one open gap
        name = sess.location.get("name", "base")
        for title, t in ((f"Day starts — {name}", sess.time_window_start), (f"Back at {name}", sess.time_window_end)):
            db.add(ItineraryItem(itinerary_id=itin.id, type="booked", status="confirmed", title=title,
                                 start_time=at(d, t.hour * 60 + t.minute), end_time=at(d, t.hour * 60 + t.minute),
                                 location_key=sess.location.get("key")))
        await db.flush()
        await recompute_gaps(db, itin.id)
    st.active_itinerary_id = itin.id
    await db.commit()
    await notify_itinerary(itin.id, reason="created")
    return await serialize_itinerary(db, itin.id)


@app.get("/itinerary/{itinerary_id}")
async def get_itinerary(itinerary_id: int, db: AsyncSession = Depends(get_db)):
    if not await db.get(Itinerary, itinerary_id):
        raise HTTPException(404, "itinerary not found")
    return await serialize_itinerary(db, itinerary_id)


@app.post("/itinerary/{itinerary_id}/gaps")
async def post_gaps(itinerary_id: int, db: AsyncSession = Depends(get_db)):
    await recompute_gaps(db, itinerary_id)
    await db.commit()
    return await serialize_itinerary(db, itinerary_id)


@app.post("/itinerary/{itinerary_id}/items")
async def add_items(itinerary_id: int, body: ItemsIn, db: AsyncSession = Depends(get_db)):
    itin = await db.get(Itinerary, itinerary_id)
    if not itin:
        raise HTTPException(404, "itinerary not found")
    created = []
    if body.experience_ids:
        gap = await db.get(ItineraryItem, body.slot_id or 0)
        if not gap or gap.type != "gap":
            raise HTTPException(409, "That free slot changed — refresh and try again.")
        st = await get_state(db)
        itin, user, sess, items, exps, vendors = await load_world(db, itinerary_id)
        ctx = build_slot_context(itin=itin, user=user, sess=sess, items=items, exp_by_id=exps,
                                 weather_bad=st.weather_bad, slot_start=gap.start_time, slot_end=gap.end_time)
        chosen = [exps[i] for i in body.experience_ids if i in exps]
        legs = _route(chosen, ctx)
        if not legs:
            raise HTTPException(409, "Those no longer fit this window.")
        if sum(e.price for e in chosen) > ctx.budget_left:
            raise HTTPException(409, "That goes over your remaining budget.")
        for exp, leg in zip(chosen, legs):
            it = ItineraryItem(itinerary_id=itinerary_id, type="suggested", status="confirmed", experience_id=exp.id,
                               title=exp.title, location_key=exp.location.get("key"),
                               start_time=at(itin.trip_date, leg["start"]), end_time=at(itin.trip_date, leg["end"]),
                               slot_start=gap.start_time, slot_end=gap.end_time, price_paid=exp.price)
            db.add(it)
            created.append(it)
        if len(chosen) > 1 and sess:
            db.add(Bundle(session_id=sess.id, experience_ids=[e.id for e in chosen], total_price=sum(e.price for e in chosen)))
        for exp in chosen:
            await bump_demand(db, f"vendor:{exp.vendor_id}", "added")
    for raw in body.items:
        if not (raw.start_time and raw.end_time):
            raise HTTPException(400, "start_time and end_time (HH:MM) required")
        it = ItineraryItem(itinerary_id=itinerary_id, type=raw.type, status="confirmed", title=raw.title,
                           experience_id=raw.experience_id, location_key=raw.location_key,
                           start_time=at(itin.trip_date, hhmm_to_min(raw.start_time)),
                           end_time=at(itin.trip_date, hhmm_to_min(raw.end_time)))
        db.add(it)
        created.append(it)
    await db.flush()
    ids = [c.id for c in created]
    await recompute_gaps(db, itinerary_id)
    await db.commit()
    await notify_itinerary(itinerary_id, reason="items_added")
    return {"created_item_ids": ids, "itinerary": await serialize_itinerary(db, itinerary_id)}


# ---------------------------------------------------------------- recommendations
@app.get("/recommendations")
async def recommendations(slot_id: int, db: AsyncSession = Depends(get_db)):
    gap = await db.get(ItineraryItem, slot_id)
    if not gap or gap.type != "gap":
        raise HTTPException(404, "slot not found (gaps are recomputed when the itinerary changes)")
    return await recommend_for_gap(db, gap)


@app.get("/experiences")
async def list_experiences(vendor_id: int | None = None, db: AsyncSession = Depends(get_db)):
    q = select(Experience).order_by(Experience.id)
    if vendor_id:
        q = q.where(Experience.vendor_id == vendor_id)
    exps = (await db.execute(q)).scalars().all()
    vendors = {v.id: v for v in (await db.execute(select(Vendor))).scalars()}
    return [serialize_exp(e, vendors.get(e.vendor_id)) for e in exps]


@app.get("/experiences/{experience_id}")
async def get_experience(experience_id: int, db: AsyncSession = Depends(get_db)):
    exp = await db.get(Experience, experience_id)
    if not exp:
        raise HTTPException(404, "experience not found")
    vendor = await db.get(Vendor, exp.vendor_id)
    reviews = (await db.execute(select(Review).where(Review.experience_id == exp.id).order_by(Review.created_at.desc()))).scalars().all()
    now = datetime.now()
    return {**serialize_exp(exp, vendor),
            "reviews": [{"rating": r.rating, "text": r.text, "days_ago": (now - r.created_at).days} for r in reviews]}


@app.post("/experiences/{experience_id}/reviews")
async def add_review(experience_id: int, body: ReviewIn, db: AsyncSession = Depends(get_db)):
    db.add(Review(experience_id=experience_id, rating=max(1, min(5, body.rating)), text=body.text, created_at=datetime.now()))
    await db.flush()
    await refresh_trust(db, experience_id)
    await db.commit()
    exp = await db.get(Experience, experience_id)
    return {"trust_score": exp.trust_score, "trust_meta": exp.trust_meta}


# ---------------------------------------------------------------- disruptions
@app.post("/disruption/trigger")
async def disruption_trigger(body: TriggerIn, db: AsyncSession = Depends(get_db)):
    itinerary_id = body.itinerary_id or await active_itinerary_id(db)
    st = await get_state(db)
    note = None
    if body.trigger_type == "unavailable":
        if body.experience_id:
            exp = await db.get(Experience, body.experience_id)
            if not exp:
                raise HTTPException(404, "experience not found")
            exp.capacity_left = 0
        elif body.vendor_id:
            v = await db.get(Vendor, body.vendor_id)
            if not v:
                raise HTTPException(404, "vendor not found")
            v.status = "closed"
        else:
            raise HTTPException(400, "experience_id or vendor_id required")
        await db.flush()
        events = await scan_unavailable(db, itinerary_id)
        await hub.broadcast({"type": "vendor_status", "vendor_id": body.vendor_id, "experience_id": body.experience_id})
    elif body.trigger_type == "weather":
        st.weather_bad = (not st.weather_bad) if body.weather_bad is None else body.weather_bad
        await db.flush()
        events = await scan_weather(db, itinerary_id) if st.weather_bad else []
        await hub.broadcast({"type": "weather", "weather_bad": st.weather_bad})
    elif body.trigger_type == "time_shrink":
        res = await trigger_running_late(db, itinerary_id, body.minutes, body.itinerary_item_id)
        events, note = res["events"], res["note"]
    elif body.trigger_type == "budget_shrink":
        if body.new_budget is None:
            raise HTTPException(400, "new_budget required")
        events = await trigger_budget(db, itinerary_id, body.new_budget)
        if not events:
            note = "Budget updated — everything already planned still fits."
    else:
        raise HTTPException(400, "unknown trigger_type")
    await db.commit()
    await notify_events(db, events)
    await notify_itinerary(itinerary_id, reason=body.trigger_type, note=note)
    return {"events": [await serialize_event(db, e, refresh=False) for e in events], "note": note,
            "weather_bad": st.weather_bad}


@app.get("/disruption/pending")
async def disruption_pending(itinerary_id: int | None = None, db: AsyncSession = Depends(get_db)):
    """Polling fallback for clients without a WebSocket."""
    itinerary_id = itinerary_id or await active_itinerary_id(db)
    evs = (await db.execute(select(DisruptionEvent).join(ItineraryItem, ItineraryItem.id == DisruptionEvent.itinerary_item_id)
                            .where(ItineraryItem.itinerary_id == itinerary_id, DisruptionEvent.resolution_status == "pending")
                            .order_by(DisruptionEvent.id.desc()))).scalars().all()
    out = [await serialize_event(db, e) for e in evs]
    await db.commit()
    return out


@app.get("/disruption/{event_id}/alternatives")
async def disruption_alternatives(event_id: int, db: AsyncSession = Depends(get_db)):
    ev = await db.get(DisruptionEvent, event_id)
    if not ev:
        raise HTTPException(404, "event not found")
    out = await serialize_event(db, ev)
    await db.commit()
    return out


@app.post("/disruption/{event_id}/resolve")
async def disruption_resolve(event_id: int, body: ResolveIn, db: AsyncSession = Depends(get_db)):
    ev = await db.get(DisruptionEvent, event_id)
    if not ev:
        raise HTTPException(404, "event not found")
    if ev.resolution_status != "pending":
        raise HTTPException(409, f"already {ev.resolution_status}")
    if body.action not in ("accept", "dismiss"):
        raise HTTPException(400, "action must be accept or dismiss")
    item = await db.get(ItineraryItem, ev.itinerary_item_id)
    try:
        result = await resolve(db, ev, body.action, body.choice)
    except ValueError as e:
        raise HTTPException(409, str(e))
    await hub.broadcast({"type": "disruption_resolved", "event_id": ev.id, "action": body.action})
    await notify_itinerary(item.itinerary_id, reason="resolved")
    return result


# ---------------------------------------------------------------- vendors
@app.get("/vendors")
async def list_vendors(db: AsyncSession = Depends(get_db)):
    vendors = (await db.execute(select(Vendor).order_by(Vendor.id))).scalars().all()
    return [{"id": v.id, "name": v.name, "status": v.status, "contact_channel": v.contact_channel,
             "onboarding_source": v.onboarding_source} for v in vendors]


@app.get("/vendor/{vendor_id}")
async def get_vendor(vendor_id: int, db: AsyncSession = Depends(get_db)):
    v = await db.get(Vendor, vendor_id)
    if not v:
        raise HTTPException(404, "vendor not found")
    exps = (await db.execute(select(Experience).where(Experience.vendor_id == vendor_id))).scalars().all()
    return {"id": v.id, "name": v.name, "status": v.status, "contact_channel": v.contact_channel,
            "onboarding_source": v.onboarding_source, "listings": [serialize_exp(e) for e in exps]}


ONBOARD_QUESTIONS = [
    "Hi! 👋 I'm the GapFill helper. What's your business called, and what experience do you offer?",
    "Where does it happen? A landmark or area is perfect (e.g. near Hawa Mahal, MI Road).",
    "How long does it take, what do you charge per person, and how many guests can you take per session?",
    "What hours can guests join? And is it indoors, outdoors, or both?",
    "Last one: who is it great for (solo, couples, families, big groups)? Any access details — step-free entry, seating, restroom, a quiet/sensory-friendly space?",
]


@app.get("/vendor/onboard/questions")
async def onboard_questions():
    return {"questions": ONBOARD_QUESTIONS}


@app.post("/vendor/onboard")
async def vendor_onboard(body: OnboardIn):
    draft, source = await nlp.extract_listing(body.answers, body.questions or ONBOARD_QUESTIONS)
    return {"draft": draft, "source": source}


@app.post("/vendor/listings")
async def vendor_publish(body: PublishIn, db: AsyncSession = Depends(get_db)):
    d = body.draft
    vendor = await db.get(Vendor, body.vendor_id) if body.vendor_id else None
    if not vendor:
        vendor = Vendor(name=body.vendor_name or d.get("vendor_name") or "New local host", contact_channel="whatsapp (demo)",
                        status="open", onboarding_source="chat")
        db.add(vendor)
        await db.flush()
    exp = Experience(
        vendor_id=vendor.id, title=d["title"], description=d.get("description", ""), category_tags=d.get("category_tags", []),
        price=float(d["price"]), duration_min=int(d["duration_min"]), location=d.get("location") or loc_of("mi_road"),
        accessibility_attributes=d.get("accessibility_attributes", {}), group_suitability=d.get("group_suitability", []),
        opening_hours=d.get("opening_hours", {}), indoor_outdoor=d.get("indoor_outdoor", "indoor"),
        capacity_left=int(d.get("capacity_left", 10)), trust_score=3.5,
        trust_meta={"count": 0, "recent_90d": 0, "plain_avg": None, "summary": "New listing, no reviews yet"})
    db.add(exp)
    await db.commit()
    await hub.broadcast({"type": "listing_published", "vendor_id": vendor.id, "experience_id": exp.id})
    await notify_itinerary(0, reason="new_listing")
    return {"vendor_id": vendor.id, "experience": serialize_exp(exp, vendor)}


@app.patch("/vendor/{vendor_id}/status")
async def vendor_status(vendor_id: int, body: VendorStatusIn, db: AsyncSession = Depends(get_db)):
    v = await db.get(Vendor, vendor_id)
    if not v:
        raise HTTPException(404, "vendor not found")
    exps = (await db.execute(select(Experience).where(Experience.vendor_id == vendor_id))).scalars().all()
    targets = [e for e in exps if e.id == body.experience_id] if body.experience_id else exps
    if body.status in ("open", "closed", "full"):
        if body.experience_id and body.status != "open":
            for e in targets:
                e.capacity_left = 0
        else:
            v.status = body.status
            if body.status == "open":
                for e in targets:
                    e.capacity_left = max(e.capacity_left, 10)
    elif body.status == "slots":
        if body.slots_left is None:
            raise HTTPException(400, "slots_left required")
        v.status = "open"
        for e in targets:
            e.capacity_left = body.slots_left
    else:
        raise HTTPException(400, "status must be open, closed, full or slots")
    await db.flush()
    st = await get_state(db)
    events = await scan_unavailable(db, st.active_itinerary_id) if st.active_itinerary_id else []
    await db.commit()
    await hub.broadcast({"type": "vendor_status", "vendor_id": v.id, "status": v.status,
                         "listings": [{"id": e.id, "capacity_left": e.capacity_left} for e in exps]})
    await notify_events(db, events)
    if st.active_itinerary_id:
        await notify_itinerary(st.active_itinerary_id, reason="vendor_status")
    return {"id": v.id, "status": v.status, "listings": [serialize_exp(e) for e in exps],
            "disruptions_created": [e.id for e in events]}


@app.get("/vendor/{vendor_id}/demand-signals")
async def demand_signals(vendor_id: int, db: AsyncSession = Depends(get_db)):
    v = await db.get(Vendor, vendor_id)
    if not v:
        raise HTTPException(404, "vendor not found")
    exps = (await db.execute(select(Experience).where(Experience.vendor_id == vendor_id))).scalars().all()
    areas = sorted({e.location.get("key") for e in exps if e.location})
    my_tags = {t for e in exps for t in e.category_tags}
    today = date.today()
    rows = (await db.execute(select(DemandSignal).where(DemandSignal.date == today))).scalars().all()
    nearby = {}
    for r in rows:
        if r.vendor_id_or_area in {f"area:{a}" for a in areas}:
            key = (r.vendor_id_or_area.split(":", 1)[1], r.query_tag)
            nearby[key] = nearby.get(key, 0) + r.count
    own = {r.query_tag: r.count for r in rows if r.vendor_id_or_area == f"vendor:{vendor_id}"}
    top = sorted(({"area": LOCATIONS.get(a, (a,))[0], "area_key": a, "tag": t, "count": c, "matches_you": t in my_tags}
                  for (a, t), c in nearby.items()), key=lambda x: -x["count"])[:8]
    insights = [f"{x['count']} travelers near {x['area']} asked for {x['tag']} today" for x in top[:3]]
    return {"vendor_id": vendor_id, "date": today.isoformat(), "areas": areas, "nearby": top,
            "own": {"shown": own.get("shown", 0), "added": own.get("added", 0), "booked": own.get("booked", 0)},
            "insights": insights}


# ---------------------------------------------------------------- booking (mock)
@app.post("/booking/confirm")
async def booking_confirm(body: BookingIn, db: AsyncSession = Depends(get_db)):
    out = []
    total = 0.0
    group = "solo"
    for iid in body.itinerary_item_ids:
        it = await db.get(ItineraryItem, iid)
        if not it or not it.experience_id:
            raise HTTPException(404, f"item {iid} not found")
        exp = await db.get(Experience, it.experience_id)
        itin = await db.get(Itinerary, it.itinerary_id)
        user = await db.get(User, itin.user_id)
        group = user.group_type
        if not it.booking_ref:
            it.booking_ref = booking_ref()
            exp.capacity_left = max(0, exp.capacity_left - HEADCOUNT.get(group, 1))
            await bump_demand(db, f"vendor:{exp.vendor_id}", "booked")
        vendor = await db.get(Vendor, exp.vendor_id)
        people = HEADCOUNT.get(group, 1)
        total += exp.price * people
        out.append({"item_id": it.id, "booking_ref": it.booking_ref, "title": exp.title, "vendor": vendor.name,
                    "start_time": it.start_time.isoformat(), "end_time": it.end_time.isoformat(),
                    "location": exp.location, "price_per_person": exp.price, "people": people})
    await db.commit()
    return {"status": "confirmed", "payment": "mock — no payment taken", "bookings": out, "total": total,
            "group_type": group}


# ---------------------------------------------------------------- websocket
@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await hub.connect(ws)
    try:
        await ws.send_text(json.dumps({"type": "hello"}))
        while True:
            msg = await asyncio.wait_for(ws.receive_text(), timeout=60)
            if msg == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
    except (WebSocketDisconnect, asyncio.TimeoutError, RuntimeError):
        pass
    finally:
        hub.drop(ws)
