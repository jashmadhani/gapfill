"""Real road geometry between points, via the free OSRM routing service, cached on disk.

Every leg is fetched once and stored in data/road_cache.json, so demos are instant and keep working if OSRM is down.
If a leg can't be fetched, it falls back to a straight line and says so (source = "line").
"""
import asyncio
import json
import math
import os

import httpx

OSRM = os.environ.get("OSRM_URL", "https://router.project-osrm.org")
CACHE_PATH = os.path.join(os.path.dirname(__file__), "data", "road_cache.json")
_cache: dict[str, dict] | None = None
_lock = asyncio.Lock()


def _load() -> dict:
    global _cache
    if _cache is None:
        try:
            with open(CACHE_PATH) as f:
                _cache = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            _cache = {}
    return _cache


def _save() -> None:
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    tmp = CACHE_PATH + ".tmp"
    with open(tmp, "w") as f:
        json.dump(_cache, f, separators=(",", ":"))
    os.replace(tmp, CACHE_PATH)


def _key(a, b) -> str:
    return f"{a[0]:.4f},{a[1]:.4f};{b[0]:.4f},{b[1]:.4f}"


def _simplify(coords: list, max_pts: int = 160) -> list:
    if len(coords) <= max_pts:
        return [[round(x, 5), round(y, 5)] for x, y in coords]
    step = len(coords) / (max_pts - 1)
    out = [coords[int(i * step)] for i in range(max_pts - 1)] + [coords[-1]]
    return [[round(x, 5), round(y, 5)] for x, y in out]


def _haversine_km(a, b) -> float:
    lng1, lat1, lng2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


async def _fetch(client: httpx.AsyncClient, a, b) -> dict | None:
    url = f"{OSRM}/route/v1/driving/{a[0]},{a[1]};{b[0]},{b[1]}?overview=full&geometries=geojson"
    try:
        r = await client.get(url, timeout=8)
        d = r.json()
        if d.get("code") != "Ok":
            return None
        rt = d["routes"][0]
        return {"coords": _simplify(rt["geometry"]["coordinates"]), "km": round(rt["distance"] / 1000, 1),
                "min": round(rt["duration"] / 60), "source": "osrm"}
    except Exception:
        return None


async def legs(points: list[list[float]], fetch: bool = True) -> list[dict]:
    """Road geometry for each consecutive pair of [lng, lat] points."""
    cache = _load()
    out, missing = [], []
    for a, b in zip(points, points[1:]):
        k = _key(a, b)
        leg = cache.get(k)
        if leg is None and (rev := cache.get(_key(b, a))):  # roads are (nearly) symmetric: reuse the reverse leg
            leg = {**rev, "coords": rev["coords"][::-1]}
        if leg is None and a == b:
            leg = {"coords": [a, b], "km": 0, "min": 0, "source": "same"}
        out.append(leg)
        if leg is None:
            missing.append((len(out) - 1, a, b, k))
    if missing and fetch:
        async with _lock, httpx.AsyncClient(headers={"User-Agent": "TourCraft demo"}) as client:
            for i, a, b, k in missing:
                leg = cache.get(k) or await _fetch(client, a, b)
                if leg:
                    cache[k] = leg
                out[i] = leg
            _save()
    for i, (a, b) in enumerate(zip(points, points[1:])):
        if out[i] is None:  # routing unavailable: honest straight-line fallback
            out[i] = {"coords": [a, b], "km": round(_haversine_km(a, b) * 1.25, 1), "min": None, "source": "line"}
    return out


async def prewarm_cities(dests: dict) -> int:
    """Fetch every city-to-city road once (run from the seed/CLI, not per request)."""
    keys = list(dests)
    pairs = [([dests[a]["lng"], dests[a]["lat"]], [dests[b]["lng"], dests[b]["lat"]]) for i, a in enumerate(keys) for b in keys[i + 1:]]
    n = 0
    for a, b in pairs:
        before = len(_load())
        await legs([a, b])
        n += len(_load()) - before
        await asyncio.sleep(0.25)  # be gentle with the free public server
    return n


if __name__ == "__main__":
    from .catalog import DESTINATIONS
    d = {k: {"lat": v[4], "lng": v[5]} for k, v in DESTINATIONS.items()}
    print("fetched", asyncio.run(prewarm_cities(d)), "new legs; cache size", len(_load()))
