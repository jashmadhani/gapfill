import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { TripModel } from "@/lib/models/trip.model";
import { PlanModel } from "@/lib/models/plan.model";
import { getActivePlanForTrip } from "@/lib/trip-helpers";
import { toSafePlan, toSafeTrip } from "@/lib/serialize";
import type { GroupType } from "@/types";

/** Plan is where FUTURE trips get built and edited day by day - distinct
 * from the Trip tab, which is the live hub for the trip already under way.
 * A user can hold several trips here; the switcher strip lists them all. */
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await connectToDatabase();
  const userId = user._id.toString();
  const trips = await TripModel.find({ userId, status: { $in: ["planning", "upcoming", "active"] } }).sort({ startDate: 1 });

  if (trips.length === 0) return NextResponse.json({ trips: [], trip: null, plan: null });

  const tripId = req.nextUrl.searchParams.get("tripId");
  const selected = (tripId && trips.find((t) => t._id.toString() === tripId)) || trips.find((t) => t.status === "planning") || trips[0];
  const plan = await getActivePlanForTrip(selected._id.toString());

  return NextResponse.json({
    trips: trips.map((t) => ({ id: t._id.toString(), title: t.title, status: t.status, startDate: t.startDate, coverImageUrl: t.coverImageUrl })),
    trip: toSafeTrip(selected),
    plan: plan ? toSafePlan(plan) : null,
  });
}

interface CreateTripBody {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  groupType: GroupType;
  adults: number;
  children: number;
  totalBudget: number;
  themeTags: string[];
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json()) as CreateTripBody;
  await connectToDatabase();

  const trip = await TripModel.create({
    tripId: `trip_${Date.now()}`,
    userId: user._id,
    title: body.title || `${body.destination} trip`,
    code: `TC-${Math.floor(1000 + Math.random() * 9000)}`,
    destination: body.destination,
    route: [],
    startDate: body.startDate,
    endDate: body.endDate,
    groupType: body.groupType || "solo",
    group: { adults: body.adults || 1, children: body.children || 0, members: [] },
    themeTags: body.themeTags || [],
    totalBudget: body.totalBudget || 0,
    totalSpent: 0,
    currency: "INR",
    payments: { total: body.totalBudget || 0, paid: 0, balance: body.totalBudget || 0 },
    status: "planning",
    checklist: [],
    risks: [],
    changes: [],
    timeline: [],
  });

  const days = Math.max(1, Math.round((new Date(body.endDate).getTime() - new Date(body.startDate).getTime()) / 86400000) + 1);
  await PlanModel.create({
    planId: `plan_${Date.now()}`,
    tripId: trip._id,
    userId: user._id,
    version: 1,
    status: "active",
    days: Array.from({ length: days }, () => []),
    totalCost: 0,
    narrative: "A fresh draft - add experiences from Discover to fill in each day.",
    alternatives: [],
    conflicts: [],
    notes: [],
    chatHistory: [],
  });

  return NextResponse.json({ trip: toSafeTrip(trip) }, { status: 201 });
}

interface PatchBody {
  tripId: string;
  itemId: string;
  action: "remove" | "toggle_lock";
}

export async function PATCH(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json()) as PatchBody;
  await connectToDatabase();
  const trip = await TripModel.findOne({ _id: body.tripId, userId: user._id });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const plan = await getActivePlanForTrip(trip._id.toString());
  if (!plan) return NextResponse.json({ error: "No active plan" }, { status: 404 });

  for (const day of plan.days) {
    const item = day.find((i) => i.itemId === body.itemId);
    if (!item) continue;
    if (body.action === "remove") item.status = "dismissed";
    if (body.action === "toggle_lock") item.locked = !item.locked;
  }
  plan.markModified("days");
  plan.modifiedAt = new Date();
  await plan.save();

  return NextResponse.json({ plan: toSafePlan(plan) });
}
