import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { TripModel } from "@/lib/models/trip.model";
import { getActivePlanForTrip, resolveCurrentTrip } from "@/lib/trip-helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  const trip = id === "current" ? await resolveCurrentTrip(user._id.toString()) : await TripModel.findOne({ _id: id, $or: [{ userId: user._id }, { memberIds: user._id }] });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const plan = await getActivePlanForTrip(trip._id.toString());

  return NextResponse.json({
    id: trip._id.toString(),
    title: trip.title,
    destination: trip.destination,
    status: trip.status,
    startDate: trip.startDate,
    endDate: trip.endDate,
    route: trip.route,
    group: trip.group,
    totalBudget: trip.totalBudget,
    totalSpent: trip.totalSpent,
    payments: trip.payments,
    checklist: trip.checklist,
    risks: trip.risks,
    changes: trip.changes,
    days: (plan?.days ?? []).map((cards, i) => ({
      day: i + 1,
      items: cards
        .filter((c) => c.status !== "dismissed")
        .map((c) => ({ title: c.title, type: c.type, startTime: c.startTime, status: c.status, typicalSpend: c.typicalSpend })),
    })),
  });
}
