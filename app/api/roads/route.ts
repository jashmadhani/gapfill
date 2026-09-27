import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";

/** Real road geometry between consecutive points, from the free OSRM routing service.
 * Each leg is fetched once and kept in memory; if a leg can't be fetched it comes back as a
 * straight line with source "line" so the map still draws and says it's approximate. */
const OSRM = process.env.OSRM_URL || "https://router.project-osrm.org";

type LngLat = [number, number];
interface Leg {
  coords: LngLat[];
  km: number;
  min: number;
  source: "osrm" | "line" | "same";
}

const cache = new Map<string, Leg>();
const key = (a: LngLat, b: LngLat) => `${a[0].toFixed(4)},${a[1].toFixed(4)};${b[0].toFixed(4)},${b[1].toFixed(4)}`;

function simplify(coords: LngLat[], max = 160): LngLat[] {
  const round = (c: LngLat): LngLat => [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5];
  if (coords.length <= max) return coords.map(round);
  const step = coords.length / (max - 1);
  return [...Array.from({ length: max - 1 }, (_, i) => coords[Math.floor(i * step)]), coords[coords.length - 1]].map(round);
}

function km(a: LngLat, b: LngLat) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b[1] - a[1]) / 2) ** 2 + Math.cos(r(a[1])) * Math.cos(r(b[1])) * Math.sin(r(b[0] - a[0]) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

async function leg(a: LngLat, b: LngLat): Promise<Leg> {
  const k = key(a, b);
  const hit = cache.get(k);
  if (hit) return hit;
  const rev = cache.get(key(b, a));
  if (rev) return { ...rev, coords: [...rev.coords].reverse() };
  if (k.split(";")[0] === k.split(";")[1]) return { coords: [a, b], km: 0, min: 0, source: "same" };

  let out: Leg | null = null;
  try {
    const res = await fetch(`${OSRM}/route/v1/driving/${a[0]},${a[1]};${b[0]},${b[1]}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(8000) });
    const d = await res.json();
    if (d.code === "Ok") {
      const rt = d.routes[0];
      out = { coords: simplify(rt.geometry.coordinates), km: Math.round(rt.distance / 100) / 10, min: Math.round(rt.duration / 60), source: "osrm" };
    }
  } catch {
    /* fall through to the straight line */
  }
  if (out) {
    cache.set(k, out);
    return out;
  }
  const d = km(a, b);
  return { coords: [a, b], km: Math.round(d * 10) / 10, min: Math.round((d / 30) * 60), source: "line" };
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { points?: LngLat[] } | null;
  const points = (body?.points ?? []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).slice(0, 14);
  if (points.length < 2) return NextResponse.json({ legs: [] });

  const legs: Leg[] = [];
  for (let i = 0; i < points.length - 1; i++) legs.push(await leg(points[i], points[i + 1]));
  return NextResponse.json({ legs });
}
