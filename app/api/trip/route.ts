import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { TripModel } from "@/lib/models/trip.model";
import { getActivePlanForTrip, resolveCurrentTrip, stageOf } from "@/lib/trip-helpers";
import { toSafePlan, toSafeTrip } from "@/lib/serialize";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await connectToDatabase();
  const trip = await resolveCurrentTrip(user._id.toString());
  if (!trip) return NextResponse.json({ trip: null, plan: null, stage: null });

  const plan = await getActivePlanForTrip(trip._id.toString());
  return NextResponse.json({
    trip: toSafeTrip(trip),
    plan: plan ? toSafePlan(plan) : null,
    stage: stageOf(trip.status),
  });
}

type ReportBody =
  | { action: "toggle_checklist"; tripId: string; key: string }
  | { action: "report_weather"; tripId: string }
  | { action: "report_late"; tripId: string; minutes: number }
  | { action: "report_budget"; tripId: string; newBudget: number }
  | { action: "start_trip"; tripId: string };

export async function PATCH(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json()) as ReportBody;
  await connectToDatabase();
  const trip = await TripModel.findOne({ _id: body.tripId, userId: user._id });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  let note = "Noted.";
  if (body.action === "toggle_checklist") {
    const item = trip.checklist.find((c) => c.key === body.key);
    if (item && !item.auto) item.done = !item.done;
    trip.markModified("checklist");
    note = "Checklist updated.";
  } else if (body.action === "report_weather") {
    trip.risks.push({ kind: "weather", level: "medium", text: "Rain reported - outdoor plans for today may need a swap." });
    trip.markModified("risks");
    note = "We've flagged today's outdoor plans for a possible swap.";
  } else if (body.action === "report_late") {
    trip.changes.push({ id: `chg_${Date.now()}`, label: `Running ${body.minutes} min late`, status: "accepted", chosenLabel: "Shifted today's remaining plan" });
    trip.markModified("changes");
    note = `Shifted today's plan by ${body.minutes} minutes.`;
  } else if (body.action === "report_budget") {
    trip.totalBudget = body.newBudget;
    if (trip.liveState) trip.liveState.budgetRemaining = body.newBudget - trip.totalSpent;
    trip.changes.push({ id: `chg_${Date.now()}`, label: "Budget changed", status: "accepted", chosenLabel: `New total ${body.newBudget}` });
    trip.markModified("changes");
    note = "Budget updated.";
  } else if (body.action === "start_trip") {
    trip.status = "active";
    trip.liveState = { currentDayIndex: 0, currentTime: new Date().toISOString(), weatherBad: false, budgetRemaining: trip.totalBudget - trip.totalSpent };
    note = "Your trip has started. Have a great day one!";
  }

  await trip.save();
  return NextResponse.json({ trip: toSafeTrip(trip), note });
}
