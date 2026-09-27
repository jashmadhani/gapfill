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

export type AuthProvider = "credentials" | "google" | "github" | string;

/**
 * One OAuth identity linked to this user. A user can hold both a
 * passwordHash (registered with credentials) AND entries here (later
 * connected Google/etc) - or only one of the two. providerAccountId is
 * that provider's stable subject id (Google's `sub`), used to find the
 * user on subsequent OAuth logins without relying on email matching alone.
 */
export interface LinkedAccount {
  provider: AuthProvider;
  providerAccountId: string;
  linkedAt: ISODateTime;
}

export interface AuthInfo {
  /** Absent for a user who has only ever signed in via OAuth. */
  passwordHash?: string;
  linkedAccounts: LinkedAccount[];
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
  /** From an OAuth provider (e.g. Google's picture) or a user upload, mirrored
   * into our own ImageKit account (Home/toure/userAvatars) rather than hot-linked,
   * so it survives the provider revoking/expiring the original URL. */
  avatarUrl?: string;
  /** ImageKit fileId backing avatarUrl, so a later re-sync/replace can
   * overwrite the same asset instead of orphaning the old one. */
  avatarImageKitFileId?: string;
  /**
   * Denormalized convenience cache of this user's trip ids, newest first.
   * Not authoritative - `trips` collection (queried by userId, indexed) is
   * the source of truth. Kept only so "my trips" can render without a query;
   * a missed push here just means a slightly stale list, never data loss.
   */
  tripIds?: Id[];
  /** POI ids the user has hearted on Discover - small enough to keep denormalized
   * on the user doc rather than a separate collection. */
  savedPoiIds?: Id[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
