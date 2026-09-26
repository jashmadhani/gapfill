import {
  EmergencyContact,
  GeoJSONPolygon,
  GeoPoint,
  Id,
  ISODateTime,
} from "./common";

/**
 * location-recogniser runs as its own server (voice/chat "where am I" safety
 * assistant) with its own fast-path JSON-file session store, but every
 * collection below lives in the SHARED database so the main backend can read
 * a traveler's last-known position, geofence, and escalation history without
 * calling that service. userId links a location-recogniser session (which is
 * keyed by phone number on its own side) back to a User/Trip in this app.
 */

export interface GpsPing extends GeoPoint {
  accuracyM: number;
  timestamp: ISODateTime;
}

export type SafeExitType = "exit" | "help" | "medical" | "transport";

export interface SafeExit {
  name: string;
  lat: number;
  lng: number;
  type: SafeExitType;
  description: string;
}

/** A geofenced zone (a venue, festival ground, market, etc). */
export interface GeoFence {
  _id: Id;
  fenceId: string;
  name: string;
  description: string;
  polygon: GeoJSONPolygon;
  safeExits: SafeExit[]; // 2-4 entries
  createdAt: ISODateTime;
}

export type LandmarkCategory =
  | "temple" | "monument" | "water" | "gate" | "tower" | "shop"
  | "vegetation" | "structure" | "signage" | "other";
export type LandmarkVisibility = "high" | "medium" | "low";
export type LandmarkSource = "organizer" | "places_api" | "streetview" | "seed";

/** A visually-identifiable reference point inside a fence, used to help a
 * disconnected/lost traveler self-describe their location by what they can see. */
export interface Landmark {
  _id: Id;
  landmarkId: string;
  fenceId: string; // ref -> GeoFence.fenceId
  name: string;
  category: LandmarkCategory;
  tags: string[];
  description: string;
  lat: number;
  lng: number;
  visibility: LandmarkVisibility;
  source: LandmarkSource;
}

export interface ItineraryStop {
  fenceId: string; // ref -> GeoFence.fenceId
  plannedArrival: ISODateTime;
  plannedDeparture: ISODateTime;
}

export type LocationSessionStatus = "active" | "resolved";

/**
 * The persisted counterpart of location-recogniser's in-memory session -
 * this is what answers "what's the last GPS we had for this traveler before
 * they went offline". Everything here is written by that separate service;
 * the main backend only ever reads it (plus writes userId once, to link a
 * phone-keyed session to an authenticated user).
 */
export interface LocationSession {
  _id: Id;
  sessionId: string;
  phoneNumber: string;
  userId?: Id; // ref -> User, once linked

  lastGps: GpsPing | null;
  snappedGps: (GpsPing & { updatedAt?: ISODateTime }) | null; // road/path-snapped position
  currentFenceId: string | null; // ref -> GeoFence.fenceId

  destinationGps?: GeoPoint | null;
  destinationLabel?: string | null;
  routePolyline?: GeoPoint[] | null;
  routeSteps?: Record<string, unknown>[] | null;
  routeDistanceM?: number | null;
  routeVerbalDirections?: string | null;

  itinerary: ItineraryStop[];
  emergencyContact: EmergencyContact;

  candidates: Record<string, unknown>[]; // candidate landmark matches during resolution
  ruledOut: string[]; // landmark ids eliminated during the conversation
  resolvedLandmarkId: string | null;

  status: LocationSessionStatus;
  callSid?: string | null;
  callStatus?: string | null;
  threadId?: string | null;

  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * The non-optional fallback when automated resolution can't safely proceed -
 * a human-in-the-loop handoff, always logged even though in the current
 * standalone service it also just appends to a local file.
 */
export interface EscalationRecord {
  _id: Id;
  sessionId: string; // ref -> LocationSession.sessionId
  userId?: Id; // ref -> User, when known
  timestamp: ISODateTime;
  reason: string;
  bestGuessLandmarkId: string | null;
  bestGuessLandmarkName: string | null;
  transcriptSummary: string;
  sharedLocation: { lat: number; lng: number; fenceId: string } | null;
  notified: string[]; // e.g. ["on_site_safety_team", "emergency_contact"]
}
