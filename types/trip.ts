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

export interface Trip {
  _id: Id;
  tripId: string;
  userId: Id; // ref -> User

  destination: string;
  startDate: ISODate;
  endDate: ISODate;
  groupType: GroupType;
  themeTags: string[];

  totalBudget: number;
  totalSpent: number;
  currency: Currency;

  status: TripStatus;
  liveState?: TripLiveState; // present only while status is "planning" | "active"

  /** Actual lived record, built up during/after the trip. Empty for a trip
   * still in pure-planning status. */
  timeline: TripTimelineEvent[];
  postTripSummary?: PostTripSummary; // present once status is "completed"

  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
