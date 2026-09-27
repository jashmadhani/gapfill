import {
  Currency,
  GeoPoint,
  GroupType,
  Id,
  ISODate,
  ISODateTime,
} from "./common";

export type TripStatus = "planning" | "upcoming" | "active" | "completed" | "cancelled";

export type TripEventType = "travel" | "meal" | "activity" | "rest" | "accommodation";

/**
 * The actual-outcome record of one lived moment of the trip, distinct from
 * the EventCard that planned it. predictedScore vs actualRating is what lets
 * the LLM learn taste drift across trips (trip-planner app/models.py).
 */
export interface TripTimelineEvent {
  timestamp: ISODateTime;
  type: TripEventType;
  poiId?: Id; // ref -> POI, when it was a planned POI rather than an ad-hoc stop
  poiNameOrDesc: string;
  location: GeoPoint;
  durationMin: number;
  amountSpent: number;
  notes?: string;
  predictedScore?: number; // planner's confidence this would be a good fit
  actualRating?: number; // traveler's rating, filled in during/after the trip
}

export interface PostTripSummary {
  overallRating: number;
  reflection: string;
  wouldRepeatTags: string[];
  wouldAvoidTags: string[];
}

/**
 * Live, mutable "where things stand right now" for an in-progress trip -
 * folds gapfill's per-day Session (location/time-window/budget-envelope/
 * intent) and single-row AppState (demo clock/weather flag/active ids)
 * into per-trip state instead of a separate collection, since in a
 * multi-user product there is one of these per trip, not a single global row.
 */
export interface TripLiveState {
  activePlanId?: string; // PlanDocument.planId currently in effect
  currentDayIndex: number;
  currentTime: ISODateTime; // real clock in prod; a settable demo clock in dev/demo mode
  weatherBad: boolean;
  budgetRemaining: number;
  intentRawText?: string; // last free-text ask that shaped the current plan
  intentParsed?: Record<string, unknown>;
}

/** One leg of a multi-city trip (gapfill's `route`), used to render the stop
 * strip on the Plan/Trip pages. Order in the array is travel order. */
export interface TripRouteStop {
  areaId: Id; // ref -> Area.areaId
  name: string;
  nights: number;
  fromDate: ISODate;
}

export interface TripGroupMember {
  name: string;
  age?: number;
}

export interface TripGroup {
  adults: number;
  children: number;
  members: TripGroupMember[];
}

/** A human tour coordinator assigned once a trip is booked (gapfill's
 * `coordinator`) - the "call your coordinator" escape hatch shown on Trip. */
export interface TripCoordinator {
  name: string;
  phone: string;
  languages: string[];
}

export interface TripChecklistItem {
  key: string;
  label: string;
  done: boolean;
  auto?: boolean; // system-managed (e.g. "balance paid"), not user-toggleable
}

export interface TripPayments {
  total: number;
  paid: number;
  balance: number;
}

export type TripRiskKind = "weather" | "unavailable" | "declined" | "connection" | "unconfirmed" | "other";
export type TripRiskLevel = "low" | "medium" | "high";

/** A surfaced "something needs your attention" line (gapfill's `risks`),
 * shown on both the Trip hub and the Plan checks panel. */
export interface TripRisk {
  kind: TripRiskKind;
  level: TripRiskLevel;
  text: string;
  itemId?: string; // ref -> EventCard.itemId this risk is about
}

export type TripChangeStatus = "accepted" | "pending" | "kept";

/** One row of "what changed and what we did about it" (gapfill's `changes`),
 * shown collapsed under "Plan changes". */
export interface TripChange {
  id: string;
  label: string;
  status: TripChangeStatus;
  chosenLabel?: string;
}

export interface Trip {
  _id: Id;
  tripId: string;
  userId: Id; // ref -> User

  title: string;
  code: string; // short human-facing booking code, e.g. "TC-4821"
  destination: string;
  coverImageUrl?: string;
  route: TripRouteStop[];
  startDate: ISODate;
  endDate: ISODate;
  groupType: GroupType;
  group: TripGroup;
  themeTags: string[];

  totalBudget: number;
  totalSpent: number;
  currency: Currency;
  payments: TripPayments;

  status: TripStatus;
  liveState?: TripLiveState; // present only while status is "planning" | "active"

  coordinator?: TripCoordinator; // present once status is "upcoming" | "active" | "completed"
  checklist: TripChecklistItem[];
  risks: TripRisk[];
  changes: TripChange[];

  /** Actual lived record, built up during/after the trip. Empty for a trip
   * still in pure-planning status. */
  timeline: TripTimelineEvent[];
  postTripSummary?: PostTripSummary; // present once status is "completed"

  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
