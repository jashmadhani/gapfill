import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { AreaModel } from "@/lib/models/area.model";
import { PoiModel } from "@/lib/models/poi.model";
import { ensureSeedData } from "@/lib/seed";
import { resolveCurrentTrip, stageOf } from "@/lib/trip-helpers";

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await connectToDatabase();
  await ensureSeedData();

  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const interest = req.nextUrl.searchParams.get("interest") || "all";

  const areas = await AreaModel.find().lean();
  const areaById = new Map(areas.map((a) => [String(a._id), a]));

  const poiQuery: Record<string, unknown> = {};
  if (interest !== "all") poiQuery.tags = interest;
  const pois = await PoiModel.find(poiQuery).lean();

  const experienceCountByArea = new Map<string, number>();
  for (const p of pois) {
    const key = p.areaId ? String(p.areaId) : "";
    experienceCountByArea.set(key, (experienceCountByArea.get(key) ?? 0) + 1);
  }

  const destinations = areas
    .map((a) => ({
      key: a.areaId,
      name: a.name,
      region: a.region,
      imageUrl: a.imageUrl,
      experiences: experienceCountByArea.get(String(a._id)) ?? 0,
    }))
    .sort((a, b) => b.experiences - a.experiences);

  const experiences = pois
    .map((p) => {
      const area = p.areaId ? areaById.get(String(p.areaId)) : undefined;
      return {
        id: String(p._id),
        title: p.name,
        destKey: area?.areaId ?? "",
        destName: area?.name ?? "",
        durationMin: p.typicalDwellMin?.typical ?? 60,
        price: p.cost?.typical_spend ?? 0,
        rating: p.ratingAvg ?? 0,
        ratingCount: p.reviewCount ?? 0,
        tags: p.tags ?? [],
        imageUrl: p.imageUrl,
      };
    })
    .filter((e) => !q || `${e.title} ${e.destName}`.toLowerCase().includes(q));

  const trip = await resolveCurrentTrip(user._id.toString());

  return NextResponse.json({
    destinations,
    experiences,
    firstName: user.name.split(" ")[0],
    savedPoiIds: user.savedPoiIds ?? [],
    currentTrip: trip
      ? { id: trip.tripId, title: trip.title, stage: stageOf(trip.status), coverImageUrl: trip.coverImageUrl }
      : null,
  });
}
