"""Seed / reset script. Run: python -m app.seed"""
import asyncio
from datetime import date, datetime, timedelta

from sqlalchemy import select

from . import models  # noqa: F401  (register tables)
from .db import Base, SessionLocal, backend_name, engine
from .engine import at, hhmm_to_min, load_travel_table, loc_of, recompute_gaps, refresh_trust
from .models import (AppState, DemandSignal, Experience, Itinerary, ItineraryItem, Review, Session, TravelTime,
                     User, Vendor)
from .seed_data import (DEFAULT_BUDGET, DEMAND_SEED, EXPERIENCES, LOCATIONS, SAMPLE_ITINERARY, TRAVEL_MINUTES,
                        TRAVELER, VENDORS)


async def create_sample_itinerary(db, user_id: int, session_id: int, trip_date: date) -> Itinerary:
    itin = Itinerary(user_id=user_id, trip_date=trip_date, session_id=session_id)
    db.add(itin)
    await db.flush()
    exp_by_key = {e.trust_meta.get("seed_key"): e for e in (await db.execute(select(Experience))).scalars()}
    for title, s, e, loc, typ, exp_key, ss, se in SAMPLE_ITINERARY:
        exp = exp_by_key.get(exp_key) if exp_key else None
        db.add(ItineraryItem(
            itinerary_id=itin.id, type=typ, start_time=at(trip_date, hhmm_to_min(s)), end_time=at(trip_date, hhmm_to_min(e)),
            experience_id=exp.id if exp else None, status="confirmed", title=title or (exp.title if exp else None),
            location_key=loc, slot_start=at(trip_date, hhmm_to_min(ss)) if ss else None,
            slot_end=at(trip_date, hhmm_to_min(se)) if se else None,
            price_paid=exp.price if exp else None, booking_ref="GF-SEED01" if exp else None,
        ))
    await db.flush()
    await recompute_gaps(db, itin.id)
    return itin


async def reset_and_seed() -> dict:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    now = datetime.now()
    today = date.today()
    async with SessionLocal() as db:
        for (a, b), mins in TRAVEL_MINUTES.items():
            db.add(TravelTime(from_key=a, to_key=b, minutes=mins))
            db.add(TravelTime(from_key=b, to_key=a, minutes=mins))

        vendor_ids = {}
        for v in VENDORS:
            row = Vendor(name=v["name"], contact_channel=v["contact_channel"], status="open", onboarding_source="seed")
            db.add(row)
            await db.flush()
            vendor_ids[v["key"]] = row.id

        for x in EXPERIENCES:
            exp = Experience(
                vendor_id=vendor_ids[x["vendor"]], title=x["title"], description=x["description"], category_tags=x["tags"],
                price=x["price"], duration_min=x["duration"], location=loc_of(x["loc"]),
                accessibility_attributes=x["access"], group_suitability=x["groups"],
                opening_hours={"open": x["hours"][0], "close": x["hours"][1]}, indoor_outdoor=x["io"],
                capacity_left=x["cap"], trust_meta={"seed_key": x["key"]},
            )
            db.add(exp)
            await db.flush()
            for rating, days, text in x["reviews"]:
                db.add(Review(experience_id=exp.id, rating=rating, text=text, created_at=now - timedelta(days=days)))
        await db.flush()
        await refresh_trust(db)

        user = User(**TRAVELER)
        db.add(user)
        await db.flush()
        name, lat, lng = LOCATIONS["hotel"]
        sess = Session(user_id=user.id, location={"key": "hotel", "name": name, "lat": lat, "lng": lng},
                       time_window_start=at(today, 7 * 60), time_window_end=at(today, 22 * 60),
                       budget_envelope=DEFAULT_BUDGET)
        db.add(sess)
        await db.flush()
        itin = await create_sample_itinerary(db, user.id, sess.id, today)

        for area, tag, count in DEMAND_SEED:
            db.add(DemandSignal(vendor_id_or_area=area, query_tag=tag, count=count, date=today))

        db.add(AppState(id=1, weather_bad=False, demo_now="11:30", active_user_id=user.id,
                        active_session_id=sess.id, active_itinerary_id=itin.id))
        await db.commit()
        await load_travel_table(db)
        return {"db": backend_name(), "user_id": user.id, "session_id": sess.id, "itinerary_id": itin.id,
                "experiences": len(EXPERIENCES), "vendors": len(VENDORS)}


if __name__ == "__main__":
    print(asyncio.run(reset_and_seed()))
