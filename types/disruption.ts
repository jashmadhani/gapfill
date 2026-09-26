import { Id, ISODate, ISODateTime } from "./common";

export type DisruptionTriggerType = "unavailable" | "weather" | "time_shrink" | "budget_shrink";
export type DisruptionResolutionStatus = "pending" | "accepted" | "dismissed";

/** One re-plan-worthy event on a specific card, and the alternatives computed
 * for it. Alternatives are recomputed on every read in gapfill, not cached -
 * `alternatives` here is a last-computed snapshot for display, not a
 * guarantee of current availability. */
export interface DisruptionEvent {
  _id: Id;
  planId: string; // ref -> PlanDocument.planId the affected card lives in
  itemId: string; // ref -> EventCard.itemId within that plan
  triggerType: DisruptionTriggerType;
  reason: string;
  context: Record<string, unknown>; // constraints to re-solve against (new budget, delay minutes, etc)
  alternatives: Record<string, unknown>[];
  resolutionStatus: DisruptionResolutionStatus;
  createdAt: ISODateTime;
  resolvedAt?: ISODateTime;
}

/** Daily counters used to surface trending areas/vendors - gapfill's
 * DemandSignal, keyed "area:<place>" or "vendor:<id>". */
export interface DemandSignal {
  _id: Id;
  vendorIdOrArea: string;
  queryTag: string;
  count: number;
  date: ISODate;
}
