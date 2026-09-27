import { TripModel, type TripHydratedDocument } from "@/lib/models/trip.model";
import { PlanModel, type PlanHydratedDocument } from "@/lib/models/plan.model";

export type TripStage = "plan" | "prepare" | "operate" | "complete";

/** Trip.status -> the coarse UI stage the reference design was built around
 * (draft plan / booked-and-waiting / live / done). */
export function stageOf(status: TripHydratedDocument["status"]): TripStage {
  if (status === "active") return "operate";
  if (status === "upcoming") return "prepare";
  if (status === "completed" || status === "cancelled") return "complete";
  return "plan";
}

/** The single trip the Trip tab and Ask tab center on: the one already
 * happening, else the soonest upcoming one, else the most recently touched
 * draft. Mirrors gapfill's single-active-tour model without hard-coding it -
 * a user can still hold several trips (surfaced on the Plan tab). */
export async function resolveCurrentTrip(userId: string): Promise<TripHydratedDocument | null> {
  const active = await TripModel.findOne({ userId, status: "active" }).sort({ startDate: 1 });
  if (active) return active;
  const upcoming = await TripModel.findOne({ userId, status: "upcoming" }).sort({ startDate: 1 });
  if (upcoming) return upcoming;
  const planning = await TripModel.findOne({ userId, status: "planning" }).sort({ updatedAt: -1 });
  if (planning) return planning;
  return TripModel.findOne({ userId, status: "completed" }).sort({ endDate: -1 });
}

export async function getActivePlanForTrip(tripId: string): Promise<PlanHydratedDocument | null> {
  return PlanModel.findOne({ tripId, status: "active" }).sort({ version: -1 });
}
