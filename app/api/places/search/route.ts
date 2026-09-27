import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { geocode, searchPlacesNear, textSearchPlaces, type PlaceResult } from "@/lib/places/geoapify";
import { getPlaceSummary } from "@/lib/places/wikipedia";

/** Powers the Browse tab's search bar. Geoapify's geocoder returns one pin
 * per query, not a useful list - so a query that resolves to a place
 * (destination, landmark, ...) is treated as "browse what's around here":
 * geocode it, then list attractions/food/parks nearby. Falls back to a raw
 * geocode match for a query specific enough that no meaningful "nearby"
 * makes sense. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ places: [], center: null });

  const center = await geocode(q);
  let places: PlaceResult[] = [];
  if (center) {
    places = await searchPlacesNear({ lat: center.lat, lng: center.lng, radiusMeters: 15000, limit: 24 });
  }
  if (places.length === 0) {
    places = await textSearchPlaces(q, 20);
  }

  const withImages = await Promise.all(
    places.map(async (p, i) => {
      if (i >= 8) return p;
      const summary = await getPlaceSummary(p.name).catch(() => null);
      return { ...p, imageUrl: summary?.imageUrl };
    })
  );

  return NextResponse.json({ places: withImages, center });
}
