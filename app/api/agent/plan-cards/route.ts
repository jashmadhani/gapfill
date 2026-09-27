import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { TripModel } from "@/lib/models/trip.model";
import { getActivePlanForTrip, resolveCurrentTrip } from "@/lib/trip-helpers";

/** The current (or a named) trip's people and day-by-day stops with their place ids, for the agent's
 * mood re-scoring. Read-only; members can read it, same as the trip itself. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await connectToDatabase();

  const which = req.nextUrl.searchParams.get("trip") || "current";
  const trip =
    which === "current"
      ? await resolveCurrentTrip(user._id.toString())
      : await TripModel.findOne({ _id: which, $or: [{ userId: user._id }, { memberIds: user._id }] }).catch(() => null);
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const plan = await getActivePlanForTrip(trip._id.toString());

  return NextResponse.json({
    tripId: trip._id.toString(),
    destination: trip.destination,
    startDate: trip.startDate,
    groupType: trip.groupType,
    themeTags: trip.themeTags,
    members: (trip.group?.members ?? []).map((m: { name: string; age?: number; stepFree?: boolean; interests?: string[] }) => ({ name: m.name, age: m.age, stepFree: !!m.stepFree, interests: m.interests })),
    days: (plan?.days ?? []).map((cards) =>
      cards
        .filter((c) => c.status !== "dismissed")
        .map((c) => ({ itemId: c.itemId, type: c.type, title: c.title, startTime: c.startTime, durationMin: c.durationMin, poiId: c.poiId ?? null, price: c.typicalSpend })),
    ),
  });
}
