import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { TripModel } from "@/lib/models/trip.model";
import { PlanModel } from "@/lib/models/plan.model";
import type { ConsideredPlace, EventCard, GroupType, PlanConflict, PlanHotel } from "@/types";

interface CreatePlanBody {
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  currency?: string;
  groupType?: GroupType;
  themeTags: string[];
  days: EventCard[][];
  hotel?: PlanHotel;
  totalCost: number;
  narrative: string;
  notes: string[];
  conflicts: PlanConflict[];
  considered?: ConsideredPlace[];
}

/** Called by agent-service once its planning pipeline (geo/dwell/scoring/
 * sequencing - see agent-service/app/planning/) has produced a full
 * itinerary. Mongo writes stay here, in TS, same as every other data-access
 * point the agent reaches through - the pipeline only computes; this
 * persists. Creates a fresh Trip in "planning" status plus its first active
 * PlanDocument version. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json()) as CreatePlanBody;
  if (!body.destination || !body.startDate || !body.endDate || !Array.isArray(body.days)) {
    return NextResponse.json({ error: "destination, startDate, endDate and days are required" }, { status: 400 });
  }

  await connectToDatabase();

  const trip = await TripModel.create({
    tripId: `trip_${Date.now()}`,
    userId: user._id,
    title: `${body.destination} trip`,
    code: `TC-${Math.floor(1000 + Math.random() * 9000)}`,
    destination: body.destination,
    route: [],
    startDate: body.startDate,
    endDate: body.endDate,
    groupType: body.groupType || "solo",
    group: { adults: 1, children: 0, members: [] },
    themeTags: body.themeTags || [],
    totalBudget: body.budget || 0,
    totalSpent: 0,
    currency: body.currency || "INR",
    payments: { total: body.budget || 0, paid: 0, balance: body.budget || 0 },
    status: "planning",
    checklist: [],
    risks: [],
    changes: [],
    timeline: [],
  });

  const plan = await PlanModel.create({
    planId: `plan_${Date.now()}`,
    tripId: trip._id,
    userId: user._id,
    version: 1,
    status: "active",
    days: body.days,
    hotel: body.hotel,
    totalCost: body.totalCost || 0,
    narrative: body.narrative || "",
    alternatives: [],
    conflicts: body.conflicts || [],
    notes: body.notes || [],
    considered: body.considered || [],
  });

  return NextResponse.json({ tripId: trip._id.toString(), planId: plan.planId, title: trip.title }, { status: 201 });
}
