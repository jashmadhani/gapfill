/** Serialized ObjectId (24-char hex string) or a domain-specific string id (e.g. "poi_123"). */
export type Id = string;

/** ISO-8601 datetime string, always UTC ("...Z"). */
export type ISODateTime = string;

/** ISO-8601 date-only string ("YYYY-MM-DD"). */
export type ISODate = string;

export type Currency = string; // ISO 4217, e.g. "INR", "USD", "EUR"

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** GeoJSON Point, for fields that need a 2dsphere index (Mongo requires this exact shape). */
export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

/** GeoJSON Polygon: linear rings of [lng, lat], first/last point identical. */
export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: [number, number][][];
}

export type GroupType = "solo" | "couple" | "family" | "large_group";

/** solo=1, couple=2, family=4, large_group=8 head count, per gapfill's booking-total rule. */
export const GROUP_HEADCOUNT: Record<GroupType, number> = {
  solo: 1,
  couple: 2,
  family: 4,
  large_group: 8,
};

export type Pace = "slow" | "moderate" | "packed";
export type BudgetSkew = "underspends" | "on-budget" | "overspends";
export type IndoorOutdoor = "indoor" | "outdoor" | "mixed";

export interface AccessibilityAttributes {
  step_free: boolean;
  seating_available: boolean;
  restroom_onsite: boolean;
  sensory_friendly: boolean;
}

/** "HH:MM" 24h clock, per weekday. Absent or "closed" means not open that day. */
export interface WeeklyOpeningHours {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
}

export interface DwellTime {
  min: number;
  typical: number;
  max: number;
}

export interface CostRange {
  min_expected_spend: number;
  typical_spend: number;
  currency: Currency;
}

export interface EmergencyContact {
  name: string;
  phone: string;
}
