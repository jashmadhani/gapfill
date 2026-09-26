import {
  AccessibilityAttributes,
  BudgetSkew,
  Currency,
  EmergencyContact,
  GroupType,
  Id,
  ISODateTime,
  Pace,
} from "./common";

/**
 * tag_affinities is the weighted signal the LLM planner actually consumes
 * (trip-planner app/models.py User.tag_affinities). travelerType is a small
 * denormalized cache of the top affinities for cheap UI filtering/display -
 * it is derived, never edited directly, and safe to be briefly stale.
 */
export interface UserPreferences {
  groupTypeDefault: GroupType;
  dietary: string[];
  accessibilityFlags: (keyof AccessibilityAttributes | string)[];
  budgetSkew: BudgetSkew;
  preferredPace: Pace;
  tagAffinities: Record<string, number>; // e.g. { culture: 0.8, crowded: -0.5 }
  travelerType: string[]; // cached top-N tag_affinities keys, refreshed after each completed trip
  homeCurrency: Currency;
}

export interface AuthInfo {
  passwordHash: string;
  provider: "credentials" | "google" | "github" | string;
  emailVerified: boolean;
  lastLoginAt?: ISODateTime;
}

/** Snapshot of the user's last known position, kept hot on the user doc so a
 * disconnect (location-recogniser's core scenario) doesn't lose it even if the
 * full ping history in `locationSessions` (see location.ts) rolls over. */
export interface LastKnownLocation {
  lat: number;
  lng: number;
  accuracyM?: number;
  recordedAt: ISODateTime;
  source: "gps" | "network" | "manual" | "geo_recognizer";
}

export interface User {
  _id: Id;
  email: string;
  name: string;
  homeCity: string;
  auth: AuthInfo;
  preferences: UserPreferences;
  emergencyContact?: EmergencyContact;
  phoneNumber?: string; // links a location-recogniser session (keyed by phone) back to this user
  lastKnownLocation?: LastKnownLocation;
  /**
   * Denormalized convenience cache of this user's trip ids, newest first.
   * Not authoritative - `trips` collection (queried by userId, indexed) is
   * the source of truth. Kept only so "my trips" can render without a query;
   * a missed push here just means a slightly stale list, never data loss.
   */
  tripIds?: Id[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
