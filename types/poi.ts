import {
  AccessibilityAttributes,
  CostRange,
  DwellTime,
  GeoJSONPoint,
  GeoPoint,
  GroupType,
  Id,
  IndoorOutdoor,
  ISODate,
  ISODateTime,
  WeeklyOpeningHours,
} from "./common";

export interface CrowdProfileEntry {
  month: number; // 1-12
  isWeekend: boolean;
  hourBucket: number; // 0-23
  crowdIndex: number; // 0.0-1.0
}

export interface AdvisoryNote {
  note: string;
  source: string;
  date: ISODate;
}

/**
 * A place, unifying gapfill's bookable Experience (local vendor listings,
 * priced per person, has capacity) with trip-planner's globally-sourced POI
 * (Google Places/Wikimedia, priced as a spend range, has crowd/advisory
 * data). `bookable` is set only when a vendor actually runs it; every POI
 * that comes out of trip-planner's search tools has bookable = undefined.
 */
export interface POI {
  _id: Id;
  poiId: string; // stable external/display id, e.g. "p_museum_123"
  name: string;
  description: string;
  category: string;
  tags: string[];
  activityType: string; // e.g. "walk", "museum", "food" - drives EventCard.activityType
  location: GeoPoint;
  geo: GeoJSONPoint; // mirror of `location`, 2dsphere-indexed for $near queries
  locationKey?: string; // stable short key for static travel-time lookups (gapfill legacy areas)
  areaId?: Id; // ref -> Area

  openingHours: WeeklyOpeningHours;
  typicalDwellMin: DwellTime;
  indoorOutdoor: IndoorOutdoor;
  groupSuitability: GroupType[];
  accessibilityAttributes: AccessibilityAttributes;

  cost: CostRange;

  /** Only present for a vendor-run, capacity-limited, bookable listing (gapfill Experience). */
  bookable?: {
    vendorId: Id;
    pricePerHead: number;
    durationMin: number;
    capacityLeft: number;
  };

  crowdProfile: CrowdProfileEntry[];
  advisoryNotes: AdvisoryNote[];

  /** Cached aggregates, recomputed on seed or on new review insert - never per request. */
  reviewCount: number;
  ratingAvg: number;
  trustScore: number;
  trustMeta: Record<string, unknown>;
  computedQualityScore?: number;

  source: "vendor" | "google_places" | "wikimedia" | "seed" | "manual";
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
