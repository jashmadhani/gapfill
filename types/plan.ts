import { GeoPoint, Id, ISODateTime } from "./common";

export type EventCardType = "travel" | "activity" | "meal" | "rest" | "accommodation" | "free_time" | "gap";

/** confirmed/booked = gapfill's "booked"; suggested = an LLM-placed idea the
 * traveler hasn't locked in; disrupted/replaced mirror gapfill's disruption
 * engine outcomes for a card that used to hold a real booking. */
export type EventCardStatus = "suggested" | "confirmed" | "pending" | "disrupted" | "replaced" | "dismissed";

export interface EventCard {
  itemId: string; // short id, stable across cascade_resolve reflows within one plan version
  type: EventCardType;
  startTime: ISODateTime;
  endTime: ISODateTime;
  durationMin: number;

  poiId?: Id; // ref -> POI
  title: string;
  activityType: string;
  location?: GeoPoint;

  minExpectedSpend: number;
  typicalSpend: number;
  fitReason?: string; // why the planner chose this, shown in UI
  accessibilityIcons: string[];
  scoreBreakdown?: Record<string, number>;
  photoRef?: string;

  /** The idle window this card was placed into, so a replan/disruption
   * re-solves against the original slot rather than the card's current
   * (possibly already-shifted) time - gapfill's slot_start/slot_end. */
  slotStart?: ISODateTime;
  slotEnd?: ISODateTime;

  locked: boolean; // survives replans/edits untouched
  status: EventCardStatus;

  booking?: {
    bookingRef: string; // e.g. "GF-XXXXXX"
    pricePaid: number;
    headCount: number;
    bookedAt: ISODateTime;
  };
}

export type ConflictLevel = "error" | "warning";

/** A validation line surfaced under "Checks" (gapfill's `conflicts`) - e.g.
 * "Day 3 has no lunch stop" or "Total exceeds budget by ₹4,000". */
export interface PlanConflict {
  level: ConflictLevel;
  text: string;
}

/** A suggested place to stay, anchored near the weighted centroid of the
 * plan's top-scored POIs (trip-planner's select_hotel step) - not a real
 * booking, just where the generated itinerary assumes the traveler sleeps. */
export interface PlanHotel {
  name: string;
  location: GeoPoint;
  address?: string;
  rating?: number;
  priceLevel?: number;
  photoUrl?: string;
  source: "geoapify" | "seed" | "manual";
}

export type PlanStatus = "active" | "superseded" | "discarded";

/**
 * One immutable snapshot of an itinerary. Every edit/insert/replan/restore
 * inserts a NEW PlanDocument with parentPlanId pointing at the one it came
 * from, flips the old doc's status to superseded/discarded, and the new
 * doc's status to active - a linked-list version chain, not an embedded
 * array on Trip. Kept as its own collection (not embedded in Trip) because
 * each version carries a full day-by-day itinerary, which would blow past
 * sane document-size growth if piled onto one Trip doc across a whole
 * trip's worth of edits. Chat with the assistant lives separately in
 * ChatSession (see chat.ts) - it's about the user, not one plan version.
 */
export interface PlanDocument {
  _id: Id;
  planId: string;
  tripId: Id; // ref -> Trip
  userId: Id; // ref -> User

  version: number;
  parentPlanId?: string; // previous PlanDocument.planId in the chain
  status: PlanStatus;

  days: EventCard[][]; // days[dayIndex] = that day's ordered cards
  hotel?: PlanHotel;

  totalCost: number;
  narrative: string; // human-readable "what changed and why" for this version
  changeReason?: string; // e.g. "User requested: more outdoors", "Disruption: vendor closed"
  alternatives: Record<string, unknown>[];
  conflicts: PlanConflict[];
  notes: string[]; // "how we optimised this" bullets shown under the price card

  createdAt: ISODateTime;
  /** When this exact version's content was last mutated in place (should be
   * rare/never post-creation, since edits create a new version - but kept
   * for parity with the "modified_at per snapshot" requirement). */
  modifiedAt: ISODateTime;
}
