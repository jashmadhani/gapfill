import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { accessFor } from "@/lib/group";
import { getActivePlanForTrip, resolveCurrentTrip, stageOf } from "@/lib/trip-helpers";
import { toSafePlan, toSafeTrip } from "@/lib/serialize";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await connectToDatabase();
  const trip = await resolveCurrentTrip(user._id.toString());
  if (!trip) return NextResponse.json({ trip: null, plan: null, stage: null, role: null });

  const plan = await getActivePlanForTrip(trip._id.toString());
  return NextResponse.json({
    trip: toSafeTrip(trip),
    plan: plan ? toSafePlan(plan) : null,
    stage: stageOf(trip.status),
    role: trip.userId.toString() === user._id.toString() ? "admin" : "member",
  });
}

type ReportBody =
  | { action: "toggle_checklist"; tripId: string; key: string }
  | { action: "report_budget"; tripId: string; newBudget: number }
  | { action: "start_trip"; tripId: string };

/** "Running late" and "it's raining" moved to the real disruption engine (POST /api/disruptions) - it scores
 * options with the ML fit model instead of just dropping a note. This route now only handles the checklist,
 * starting the trip, and the budget slider (which anyone can nudge; the admin still decides what to actually
 * change, same as every other disruption). */
export async function PATCH(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json()) as ReportBody;
  await connectToDatabase();
  const access = await accessFor(body.tripId, user._id.toString());
  if (!access) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const { trip } = access;

  let note = "Noted.";
  if (body.action === "toggle_checklist") {
    const item = trip.checklist.find((c) => c.key === body.key);
    if (item && !item.auto) item.done = !item.done;
    trip.markModified("checklist");
    note = "Checklist updated.";
  } else if (body.action === "report_budget") {
    if (access.role !== "admin") return NextResponse.json({ error: "Only the trip admin can change the budget" }, { status: 403 });
    trip.totalBudget = body.newBudget;
    if (trip.liveState) trip.liveState.budgetRemaining = body.newBudget - trip.totalSpent;
    trip.changes = [...trip.changes, { id: `chg_${Date.now()}`, label: "Budget changed", status: "accepted", chosenLabel: `New total ${body.newBudget}` }];
    trip.markModified("changes");
    note = "Budget updated.";
  } else if (body.action === "start_trip") {
    if (access.role !== "admin") return NextResponse.json({ error: "Only the trip admin can start the trip" }, { status: 403 });
    trip.status = "active";
    trip.liveState = { currentDayIndex: 0, currentTime: new Date().toISOString(), weatherBad: false, budgetRemaining: trip.totalBudget - trip.totalSpent };
    note = "Your trip has started. Have a great day one!";
  }

  await trip.save();
  return NextResponse.json({ trip: toSafeTrip(trip), note });
}
