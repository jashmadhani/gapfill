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
 * A user can hold several trips here; the switcher strip lists them all.
 * Deliberately excludes "active" trips - once a trip has started, it lives
 * on the Trip tab, not here. */
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await connectToDatabase();
  const userId = user._id.toString();
  const trips = await TripModel.find({ userId, status: { $in: ["planning", "upcoming"] } }).sort({ startDate: 1 });

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
  });

  return NextResponse.json({ trip: toSafeTrip(trip) }, { status: 201 });
}

interface PatchBody {
  tripId: string;
  itemId?: string;
  action: "remove" | "toggle_lock" | "add_considered";
  /** add_considered: which left-out place to bring into the plan, and on which day (1-based). */
  key?: string;
  day?: number;
}

const iso = (d: Date) => d.toISOString();

export async function PATCH(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json()) as PatchBody;
  await connectToDatabase();
  const trip = await TripModel.findOne({ _id: body.tripId, userId: user._id });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const plan = await getActivePlanForTrip(trip._id.toString());
  if (!plan) return NextResponse.json({ error: "No active plan" }, { status: 404 });

  if (body.action === "add_considered") {
    // Bring a place the planner left out into the plan: append after the day's last stop.
    const entry = (plan.considered ?? []).find((c) => c.key === body.key);
    if (!entry) return NextResponse.json({ error: "That place is no longer in the left-out list" }, { status: 404 });
    const dayIdx = Math.min(Math.max((body.day ?? 1) - 1, 0), plan.days.length - 1);
    if (dayIdx < 0) return NextResponse.json({ error: "This plan has no days yet" }, { status: 400 });
    const live = plan.days[dayIdx].filter((c) => c.status !== "dismissed").sort((a, b) => a.startTime.localeCompare(b.startTime));
    const dayStart = new Date(`${trip.startDate}T09:00:00.000Z`);
    dayStart.setUTCDate(dayStart.getUTCDate() + dayIdx);
    const dayEnd = new Date(dayStart.getTime() + 12.5 * 3600000); // 21:30
    const duration = entry.durationMin ?? 60;
    // First gap in the day that fits it (between 09:00 and 21:30); otherwise after the last stop.
    const candidates = [dayStart, ...live.map((c) => new Date(new Date(c.endTime).getTime() + 15 * 60000))];
    const fits = (t: Date) => {
      const end = t.getTime() + duration * 60000;
      return end <= dayEnd.getTime() && live.every((c) => end <= new Date(c.startTime).getTime() || t.getTime() >= new Date(c.endTime).getTime());
    };
    const last = live[live.length - 1];
    const start = candidates.find(fits) ?? (last ? new Date(new Date(last.endTime).getTime() + 15 * 60000) : dayStart);
    plan.days[dayIdx].push({
      itemId: `d${dayIdx}_${entry.key}_${Date.now()}`,
      type: "activity",
      startTime: iso(start),
      endTime: iso(new Date(start.getTime() + duration * 60000)),
      durationMin: duration,
      poiId: entry.poiId ?? undefined,
      title: entry.name,
      activityType: "activity",
      location: entry.location,
      minExpectedSpend: Math.round(entry.price * 0.7),
      typicalSpend: entry.price,
      fitReason: "Added from the left-out list",
      accessibilityIcons: [],
      photoRef: entry.imageUrl ?? undefined,
      locked: false,
      status: "suggested",
    });
    plan.considered = plan.considered.filter((c) => c.key !== body.key);
    plan.totalCost = (plan.totalCost ?? 0) + entry.price;
    plan.markModified("days");
    plan.markModified("considered");
    plan.modifiedAt = new Date();
    await plan.save();
    return NextResponse.json({ plan: toSafePlan(plan) });
  }

  for (const day of plan.days) {
    const item = day.find((i) => i.itemId === body.itemId);
    if (!item) continue;
    if (body.action === "remove") {
      item.status = "dismissed";
      // Keep what you removed visible, so it can be put back.
      if (item.type === "activity" && item.location && !(plan.considered ?? []).some((c) => c.key === item.itemId)) {
        plan.considered = [
          { poiId: item.poiId ?? null, key: item.itemId, name: item.title, price: item.typicalSpend, priceSource: "catalog", durationMin: item.durationMin,
            tags: [], imageUrl: item.photoRef ?? null, location: item.location, verdict: "left_out", reasons: ["You removed this from the plan"] },
          ...(plan.considered ?? []),
        ];
        plan.markModified("considered");
      }
    }
    if (body.action === "toggle_lock") item.locked = !item.locked;
  }
  plan.markModified("days");
  plan.modifiedAt = new Date();
  await plan.save();

  return NextResponse.json({ plan: toSafePlan(plan) });
}
