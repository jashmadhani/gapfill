import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { AreaModel } from "@/lib/models/area.model";
import { PoiModel } from "@/lib/models/poi.model";

/** Curated experiences for one destination, for the planner to choose from.
 * Matches by area key ("jaipur"), area name, or a loose "Jaipur, India" style
 * query. Returns `area: null` when the destination isn't in the catalog so
 * the caller can fall back to live Geoapify results. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const raw = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  if (!raw) return NextResponse.json({ error: "q is required" }, { status: 400 });

  await connectToDatabase();
  const areas = await AreaModel.find().lean();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const q = norm(raw);
  const area = areas.find((a) => norm(a.areaId) === q || norm(a.name) === q) ?? areas.find((a) => q.includes(norm(a.name)) || q.includes(norm(a.areaId)));
  if (!area) return NextResponse.json({ area: null, pois: [] });

  const pois = await PoiModel.find({ areaId: area._id }).lean();
  return NextResponse.json({
    area: { areaId: area.areaId, name: area.name, region: area.region, location: area.location ?? null, imageUrl: area.imageUrl ?? null },
    pois: pois.map((p) => ({
      poiId: p.poiId,
      id: String(p._id),
      name: p.name,
      description: p.description,
      category: p.category,
      tags: p.tags ?? [],
      lat: p.location?.lat,
      lng: p.location?.lng,
      price: p.cost?.typical_spend ?? 0,
      rating: p.ratingAvg ?? 0,
      ratingCount: p.reviewCount ?? 0,
      durationMin: p.typicalDwellMin?.typical ?? 60,
      indoorOutdoor: p.indoorOutdoor,
      imageUrl: p.imageUrl ?? null,
      stepFree: !!p.accessibilityAttributes?.step_free,
      attrs: p.attrs ?? {},
      openingHours: p.openingHours ?? {},
    })),
  });
}
