/** Geoapify (https://www.geoapify.com/) - free-tier place search and
 * geocoding. Used by both the Browse tab's search and the Plan tab's trip
 * generator, so it lives here once rather than being duplicated in the
 * agent-service (which calls back into /api/places/search instead of
 * hitting Geoapify itself - see toure/agent-service/README.md's data-access
 * pattern). */

const BASE = "https://api.geoapify.com";

function apiKey() {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) throw new Error("Missing GEOAPIFY_API_KEY environment variable");
  return key;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formatted: string;
  category?: string;
}

export async function geocode(query: string): Promise<GeocodeResult | null> {
  const url = `${BASE}/v1/geocode/search?text=${encodeURIComponent(query)}&limit=1&apiKey=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature) return null;
  const [lng, lat] = feature.geometry.coordinates;
  return { lat, lng, formatted: feature.properties.formatted, category: feature.properties.result_type };
}

export interface PlaceResult {
  id: string;
  name: string;
  lat: number;
  lng: number;
  categories: string[];
  address?: string;
  distanceMeters?: number;
}

const DEFAULT_CATEGORIES = [
  "tourism.sights",
  "tourism.attraction",
  "entertainment",
  "catering.restaurant",
  "catering.cafe",
  "leisure.park",
].join(",");

interface SearchPlacesOptions {
  lat: number;
  lng: number;
  radiusMeters?: number;
  categories?: string;
  text?: string;
  limit?: number;
}

export async function searchPlacesNear({ lat, lng, radiusMeters = 8000, categories = DEFAULT_CATEGORIES, text, limit = 20 }: SearchPlacesOptions): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    categories,
    filter: `circle:${lng},${lat},${radiusMeters}`,
    bias: `proximity:${lng},${lat}`,
    limit: String(limit),
    apiKey: apiKey(),
  });
  if (text) params.set("name", text);

  const res = await fetch(`${BASE}/v2/places?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();

  return (data.features ?? [])
    .filter((f: { properties?: { name?: string } }) => f.properties?.name)
    .map((f: { properties: { place_id: string; name: string; categories?: string[]; formatted?: string; distance?: number }; geometry: { coordinates: [number, number] } }) => ({
      id: f.properties.place_id,
      name: f.properties.name,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      categories: f.properties.categories ?? [],
      address: f.properties.formatted,
      distanceMeters: f.properties.distance,
    }));
}

/** Free-text place search (not anchored to a known lat/lng) - used by the
 * Browse tab's search bar, where the query is a place name, not a category. */
export async function textSearchPlaces(query: string, limit = 20): Promise<PlaceResult[]> {
  const params = new URLSearchParams({ text: query, limit: String(limit), apiKey: apiKey() });
  const res = await fetch(`${BASE}/v1/geocode/search?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.features ?? [])
    .filter((f: { properties?: { name?: string; formatted?: string } }) => f.properties?.name || f.properties?.formatted)
    .map((f: { properties: { place_id: string; name?: string; formatted: string; categories?: string[] }; geometry: { coordinates: [number, number] } }) => ({
      id: f.properties.place_id,
      name: f.properties.name ?? f.properties.formatted,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      categories: f.properties.categories ?? [],
      address: f.properties.formatted,
    }));
}
