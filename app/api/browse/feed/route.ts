import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { AreaModel } from "@/lib/models/area.model";
import { PoiModel } from "@/lib/models/poi.model";
import { TripModel } from "@/lib/models/trip.model";
import { ensureSeedData } from "@/lib/seed";
import { geocode } from "@/lib/places/geoapify";
import { getWeather } from "@/lib/places/open-meteo";

interface FeedItem {
  key: string;
  name: string;
  region: string;
  imageUrl?: string;
  lat: number;
  lng: number;
  subtitle: string;
}

/** Geocoding + forecasts change slowly relative to page loads, and the
 * catalog is small - cache per server instance for an hour rather than
 * re-hitting Geoapify/Open-Meteo on every Browse visit. */
const CACHE_MS = 60 * 60 * 1000;
const placeCache = new Map<string, { at: number; lat: number; lng: number; avgHighC: number | null; wetDays: number }>();

async function locate(name: string, region: string) {
  const key = `${name}|${region}`;
  const hit = placeCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;

  const geo = await geocode(`${name}, ${region}`).catch(() => null);
  if (!geo) return null;
  const weather = await getWeather(geo.lat, geo.lng).catch(() => null);
  const highs = weather?.dailyHighC ?? [];
  const entry = {
    at: Date.now(),
    lat: geo.lat,
    lng: geo.lng,
    avgHighC: highs.length ? Math.round(highs.reduce((a, b) => a + b, 0) / highs.length) : null,
    // WMO codes >= 51 are drizzle/rain/snow/showers/thunderstorm
    wetDays: (weather?.dailyConditionCode ?? []).filter((c) => c >= 51).length,
  };
  placeCache.set(key, entry);
  return entry;
}

/** Feeds the Browse tab's two carousels. There's no real "events" data
 * source anywhere in this app, so rather than invent one, the second
 * carousel is honest about what it is: places with good weather over the
 * next few days, listing the user's own past destinations first. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await connectToDatabase();
  await ensureSeedData();

  const [areas, trips] = await Promise.all([AreaModel.find().lean(), TripModel.find({ userId: user._id }).lean()]);

  const visited = new Set<string>();
  const pastTags = new Set<string>();
  for (const t of trips) {
    visited.add(t.destination.toLowerCase());
    for (const r of t.route ?? []) visited.add(String(r.name).toLowerCase());
    for (const tag of t.themeTags ?? []) pastTags.add(tag);
  }

  const located = (
    await Promise.all(
      areas.map(async (a) => {
        const loc = await locate(a.name, a.region);
        if (!loc) return null;
        const pois = await PoiModel.find({ areaId: a._id }).lean();
        const overlap = pois.filter((p) => (p.tags ?? []).some((tag) => pastTags.has(tag))).length;
        return { area: a, loc, poiCount: pois.length, overlap, isVisited: visited.has(a.name.toLowerCase()) };
      })
    )
  ).filter((x): x is NonNullable<typeof x> => x !== null);

  const toItem = (x: (typeof located)[number], subtitle: string): FeedItem => ({
    key: x.area.areaId,
    name: x.area.name,
    region: x.area.region,
    imageUrl: x.area.imageUrl,
    lat: x.loc.lat,
    lng: x.loc.lng,
    subtitle,
  });

  const recommended = [...located]
    .sort((a, b) => Number(a.isVisited) - Number(b.isVisited) || b.overlap - a.overlap || b.poiCount - a.poiCount)
    .map((x) => toItem(x, pastTags.size && x.overlap ? `${x.overlap} ${x.overlap === 1 ? "thing" : "things"} matching your taste` : `${x.poiCount} ${x.poiCount === 1 ? "experience" : "experiences"}`));

  const goodWeather = located
    .filter((x) => x.loc.avgHighC !== null)
    .sort((a, b) => a.loc.wetDays - b.loc.wetDays || Number(b.isVisited) - Number(a.isVisited))
    .slice(0, 6)
    .map((x) => toItem(x, `${x.loc.avgHighC}C highs, ${x.loc.wetDays === 0 ? "dry" : `${x.loc.wetDays} wet day${x.loc.wetDays > 1 ? "s" : ""}`} this week`));

  return NextResponse.json({ recommended, goodWeather, hasHistory: trips.length > 0 });
}
