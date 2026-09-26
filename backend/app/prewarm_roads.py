"""Pre-fetch real road legs for every tour day (hotel -> activities in order). Run: python -m app.prewarm_roads"""
import asyncio

from sqlalchemy import select

from . import roads as R
from .db import SessionLocal
from .models import Offering, TourItem


async def main():
    async with SessionLocal() as db:
        offs = {o.id: o for o in (await db.execute(select(Offering))).scalars()}
        items = (await db.execute(select(TourItem).where(TourItem.status.notin_(["replaced", "cancelled"])))).scalars().all()
    days: dict[tuple, list] = {}
    for i in sorted(items, key=lambda x: (x.tour_id, x.day, x.start_min or 0)):
        o = offs.get(i.offering_id)
        if o and i.kind in ("hotel", "activity") and o.lat:
            days.setdefault((i.tour_id, i.day), []).append([o.lng, o.lat])
    before = len(R._load())
    for pts in days.values():
        if len(pts) > 1:
            await R.legs(pts[:12])
            await asyncio.sleep(0.2)
    print(f"{len(days)} tour-days, {len(R._load()) - before} new legs, cache {len(R._load())}")


if __name__ == "__main__":
    asyncio.run(main())
