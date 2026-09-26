import { Id, ISODateTime } from "./common";

export interface AdvisorySummary {
  reportCount: number;
  category: string;
  dateRange: string;
  source: string;
}

/** A named region/neighborhood, used for grouping POIs and area-level travel
 * advisories (trip-planner's Area). */
export interface Area {
  _id: Id;
  areaId: string;
  name: string;
  advisorySummary?: AdvisorySummary;
}

export type TravelMode = "walk" | "auto_rickshaw" | "cab" | "transit" | "drive";

/**
 * Cached point-to-point travel time/distance, keyed by mode and time-of-week
 * bucket. Covers both trip-planner's live-computed TravelCacheEntry (origin/
 * dest POI ids, real durations from a maps API) and gapfill's static
 * symmetric lookup table (locationKey pairs, precomputed once, no maps API) -
 * `mode` defaults to the gapfill demo's implicit auto-rickshaw/cab blend when
 * a deployment has no live maps provider.
 */
export interface TravelCacheEntry {
  _id: Id;
  originId: string; // POI.poiId or POI.locationKey
  destId: string;
  mode: TravelMode;
  weekday?: number; // 0-6, omitted for a static/symmetric (non-time-aware) entry
  hourBucket?: number; // 0-23
  durationMin: number;
  distanceKm?: number;
  cachedAt: ISODateTime;
}
