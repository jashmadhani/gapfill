import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { searchPlacesNear } from "@/lib/places/geoapify";

/** Category-scoped search around a known point - used by the Plan tab's
 * trip generator to gather candidate POIs/hotels around a geocoded
 * destination, and reusable later for "things to do near X" on a place
 * detail page. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const categories = req.nextUrl.searchParams.get("categories") || undefined;
  const radiusMeters = Number(req.nextUrl.searchParams.get("radius")) || undefined;
  const limit = Number(req.nextUrl.searchParams.get("limit")) || undefined;

  const places = await searchPlacesNear({ lat, lng, categories, radiusMeters, limit });
  return NextResponse.json({ places });
}
