"""(Re)create tables and load the demo world. Run: python -m app.seed"""
import asyncio
from datetime import date, datetime, timedelta

from sqlalchemy import select

from . import planner as P
from .catalog import (ACT_COORDS, ACTIVITIES, COORDINATORS, CUSTOMERS, DESTINATIONS, HOTELS, REVIEW_SNIPPETS, TIER_AMENITIES,
                      TRANSPORT)
from .db import Base, SessionLocal, engine
from .models import (AppState, ChatMessage, Coordinator, Customer, Destination, Offering, Payment, Review, Task, Tour,
                     TourItem, Vendor)
from .services import book_tour, load_items, new_row

# (customer idx, title, start offset from today, days, prefs, lifecycle)
TOURS = [
    (0, "Royal Rajasthan for Two", -1, 7, {"destinations": ["jaipur", "jodhpur", "udaipur"], "start_city": "delhi", "adults": 2, "children": 0,
     "budget": 125000, "hotel_tier": "standard", "transport": "best", "interests": ["heritage", "food", "culture", "photography"], "pace": "balanced"}, "active"),
    (1, "Tigers & Forts Family Trip", -2, 6, {"destinations": ["ranthambore", "jaipur"], "start_city": "delhi", "adults": 2, "children": 2,
     "budget": 160000, "hotel_tier": "premium", "transport": "best", "interests": ["wildlife", "heritage", "nature"], "pace": "relaxed"}, "operate"),
    (2, "Crafts & Kitchens of Rajasthan", 6, 8, {"destinations": ["jaipur", "pushkar", "udaipur"], "start_city": "jaipur", "adults": 1, "children": 0,
     "budget": 80000, "hotel_tier": "standard", "transport": "train", "interests": ["workshop", "food", "culture", "photography"], "pace": "balanced"}, "prepare"),
    (3, "Lakes & Palaces Getaway", 15, 5, {"destinations": ["udaipur"], "start_city": "udaipur", "adults": 4, "children": 1,
     "budget": 380000, "hotel_tier": "luxury", "transport": "car", "interests": ["relaxation", "heritage", "food"], "pace": "relaxed"}, "prepare_paid"),
    (4, "Desert Offsite 2026", 30, 4, {"destinations": ["jaisalmer"], "start_city": "jodhpur", "adults": 14, "children": 0,
     "budget": 320000, "hotel_tier": "standard", "transport": "car", "interests": ["adventure", "culture", "nightlife"], "pace": "packed"}, "draft"),
    (5, "Golden Triangle Classic", -12, 6, {"destinations": ["agra", "jaipur"], "start_city": "delhi", "adults": 2, "children": 0,
     "budget": 130000, "hotel_tier": "premium", "transport": "best", "interests": ["heritage", "culture", "food"], "pace": "balanced"}, "complete"),
    (6, "Blue & Gold Road Trip", -25, 6, {"destinations": ["jodhpur", "jaisalmer"], "start_city": "jodhpur", "adults": 4, "children": 0,
     "budget": 125000, "hotel_tier": "budget", "transport": "car", "interests": ["adventure", "nightlife", "photography"], "pace": "packed"}, "reviewed"),
]


from .catalog_extra import EXTRA_TOURS  # noqa: E402

TOURS += EXTRA_TOURS


def _jitter(i: int):
    return ((i * 37) % 11 - 5) * 0.006, ((i * 53) % 13 - 6) * 0.006


async def reset_and_seed(today: date | None = None) -> dict:
    today = today or date.today()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db:
        db.add(AppState(id=1, demo_date=today, demo_time="11:30", rain=[]))
        for k, (name, region, tag, desc, lat, lng, tags, nights, airport, rail, months) in DESTINATIONS.items():
            db.add(Destination(key=k, name=name, region=region, tagline=tag, description=desc, lat=lat, lng=lng, tags=tags,
                               ideal_nights=nights, airport=airport, rail=rail, best_months=months))
        vendors: dict[str, Vendor] = {}

        async def vendor(name, kind, dest):
            if name not in vendors:
                v = Vendor(name=name, kind=kind, dest_key=dest, phone=f"+91 98290 {10 + len(vendors):02d}{(len(vendors) * 137) % 1000:03d}", contact="Ops desk")
                db.add(v)
                await db.flush()
                vendors[name] = v
            return vendors[name]

        for idx, (dest, title, tags, dur, price, op, cl, io, rating, cnt, kids, step, closed, vname, desc) in enumerate(ACTIVITIES):
            v = await vendor(vname, "activity", dest)
            dlat, dlng = _jitter(idx)
            lat, lng = ACT_COORDS.get(title, (DESTINATIONS[dest][4] + dlat, DESTINATIONS[dest][5] + dlng))
            o = Offering(vendor_id=v.id, kind="activity", dest_key=dest, title=title, description=desc, tags=tags, duration_min=dur,
                         price=price, open=op, close=cl, indoor_outdoor=io, rating=rating, rating_count=cnt, kid_friendly=kids,
                         step_free=step, closed_weekdays=closed, lat=lat, lng=lng,
                         capacity=12 + idx % 10)
            db.add(o)
            await db.flush()
            for j in range(3):
                r = 5 if (idx + j) % 4 else 4 if (idx + j) % 7 else 3
                snip = REVIEW_SNIPPETS[r][(idx + j) % len(REVIEW_SNIPPETS[r])]
                db.add(Review(offering_id=o.id, author=["Ananya", "Mark", "Riya", "Hiroshi", "Fatima", "Leo"][(idx + j) % 6],
                              rating=r, text=snip, created_at=datetime.utcnow() - timedelta(days=4 + (idx * 7 + j * 19) % 80)))
        for dest, hotels in HOTELS.items():
            for idx, (tier, name, price, rating) in enumerate(hotels):
                v = await vendor(name, "hotel", dest)
                dlat, dlng = _jitter(idx + 3)
                db.add(Offering(vendor_id=v.id, kind="hotel", dest_key=dest, title=name, tier=tier, price=price, rating=rating,
                                rating_count=80 + idx * 55, indoor_outdoor="indoor", amenities=TIER_AMENITIES[tier],
                                step_free=tier in ("premium", "luxury"), lat=DESTINATIONS[dest][4] + dlat, lng=DESTINATIONS[dest][5] + dlng,
                                description=f"{tier.title()} stay in {DESTINATIONS[dest][0]}.", capacity=20))
        for name, mode, rate, contact in TRANSPORT:
            v = await vendor(name, "transport", None)
            db.add(Offering(vendor_id=v.id, kind="transport", title={"car": "Private car transfers", "train": "Intercity rail tickets",
                                                                      "flight": "Domestic flights"}[mode], mode=mode, price=rate, rating=4.4,
                            rating_count=900, description=f"{name} — {contact}"))
        for name, email, ph, city, seg, ints in CUSTOMERS:
            db.add(Customer(name=name, email=email, phone=ph, city=city, segment=seg, interests=ints))
        for name, ph, base, langs in COORDINATORS:
            db.add(Coordinator(name=name, phone=ph, base=base, languages=langs))
        await db.commit()

        await P.load_world(db)
        customers = list((await db.execute(select(Customer).order_by(Customer.id))).scalars())
        active_id = None
        for n, (ci, title, offset, days, prefs, life) in enumerate(TOURS):
            start = today + timedelta(days=offset)
            res = P.plan({**prefs, "days": days}, start)
            cust = customers[ci]
            adults, kids = prefs["adults"], prefs["children"]
            tour = Tour(code=f"TC-{2600 + n + 1}", title=title, customer_id=cust.id, start_date=start, days=days, prefs={**prefs, "days": days},
                        group={"name": cust.name, "adults": adults, "children": kids,
                               "members": [cust.name.split(" ")[0]] + [f"Guest {k + 2}" for k in range(adults + kids - 1)]},
                        route=res["route"], notes=res["warnings"] + res["notes"], checklist={},
                        created_at=datetime.utcnow() - timedelta(days=max(3, 20 - offset)))
            db.add(tour)
            await db.flush()
            for i in res["items"]:
                await new_row(db, tour, i, False)
            await db.flush()
            if life == "draft":
                continue
            await book_tour(db, tour, "deposit")
            await db.flush()
            rows = await load_items(db, tour.id)
            tasks = list((await db.execute(select(Task).where(Task.tour_id == tour.id))).scalars())
            for t in tasks:
                t.status = "done"
            for r in rows:
                r.vendor_status = "confirmed"
            total = sum(p.amount for p in (await db.execute(select(Payment).where(Payment.tour_id == tour.id))).scalars()) / 0.30
            if life in ("operate", "active", "complete", "reviewed", "prepare_paid"):
                db.add(Payment(tour_id=tour.id, amount=round(total * 0.70), kind="payment", method="card", note="Balance"))
            if life == "prepare":
                tour.checklist = {"ids": True}
            if life == "active":
                active_id = tour.id
                tour.checklist = {"ids": True, "vouchers": True, "coordinator": True}
                # leave tomorrow's bookings awaiting vendor confirmation so the vendor portal has live requests
                for r in rows:
                    if r.day == 3 and r.kind in ("hotel", "activity"):
                        r.vendor_status = "pending"
                        for t in tasks:
                            if r.booking_ref and r.booking_ref in t.text:
                                t.status = "open"
                db.add(ChatMessage(tour_id=tour.id, role="assistant",
                                   text=f"Welcome to day 2, {cust.name.split(' ')[0]}! Ask me anything — “what's next?”, “add a cooking class”, or “I'm running late”."))
            if life == "reviewed":
                tour.status = "reviewed"
                tour.review = {"overall": 5, "text": "Seamless from start to finish — the coordinator re-planned our desert day in minutes when the jeep broke down.",
                               "at": (start + timedelta(days=days + 1)).isoformat()}
                for r in rows:
                    if r.kind == "activity":
                        r.rating = 5 if r.id % 3 else 4
        st = await db.get(AppState, 1)
        st.active_tour_id = active_id
        await db.commit()
        await P.load_world(db)
    return {"active_tour_id": active_id, "demo_date": today.isoformat()}


if __name__ == "__main__":
    print(asyncio.run(reset_and_seed()))
