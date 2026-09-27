import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { AreaModel } from "@/lib/models/area.model";
import { PoiModel } from "@/lib/models/poi.model";
import { ensureSeedData } from "@/lib/seed";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await connectToDatabase();
  await ensureSeedData();

  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const interest = req.nextUrl.searchParams.get("interest");
  const query: Record<string, unknown> = {};
  if (interest) query.tags = interest;

  const [pois, areas] = await Promise.all([PoiModel.find(query).limit(30).lean(), AreaModel.find().lean()]);
  const areaById = new Map(areas.map((a) => [String(a._id), a]));

  const experiences = pois
    .map((p) => ({
      title: p.name,
      destination: p.areaId ? (areaById.get(String(p.areaId))?.name ?? "") : "",
      price: p.cost?.typical_spend ?? 0,
      rating: p.ratingAvg ?? 0,
      tags: p.tags ?? [],
    }))
    .filter((e) => !q || `${e.title} ${e.destination}`.toLowerCase().includes(q))
    .slice(0, 10);

  return NextResponse.json({ experiences });
}
