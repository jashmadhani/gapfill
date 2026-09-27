import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { accessFor } from "@/lib/group";
import { TripModel } from "@/lib/models/trip.model";
import { getActivePlanForTrip, resolveCurrentTrip, stageOf } from "@/lib/trip-helpers";
import { toSafePlan, toSafeTrip } from "@/lib/serialize";

/** resolveCurrentTrip() picks one trip account-wide (active, else soonest-upcoming, else most-recent draft) - with
 * more than one active/upcoming trip that guess is often wrong (it picks whichever starts soonest, not whichever
 * the traveller actually opened). ?tripId= lets the page ask for a specific one explicitly; the switcher chips
 * (built from `others`) let the traveller move between every trip that's actually live/booked without guessing. */
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await connectToDatabase();
  const userId = user._id.toString();
  const requested = req.nextUrl.searchParams.get("tripId");
  const trip = requested ? (await accessFor(requested, userId))?.trip ?? null : await resolveCurrentTrip(userId);

  const live = await TripModel.find({ $or: [{ userId }, { memberIds: user._id }], status: { $in: ["upcoming", "active"] } })
    .sort({ startDate: 1 })
    .lean();
  const others = live.map((t) => ({ id: t._id.toString(), title: t.title, status: t.status, startDate: t.startDate }));

  if (!trip) return NextResponse.json({ trip: null, plan: null, stage: null, role: null, others });

  const plan = await getActivePlanForTrip(trip._id.toString());
  return NextResponse.json({
    trip: toSafeTrip(trip),
    plan: plan ? toSafePlan(plan) : null,
    stage: stageOf(trip.status),
    role: trip.userId.toString() === userId ? "admin" : "member",
    others,
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
