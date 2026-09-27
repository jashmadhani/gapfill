import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { TripModel } from "@/lib/models/trip.model";

/** Every trip this account is part of, with its role in each (for the Profile tab). */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await connectToDatabase();
  const trips = await TripModel.find({ $or: [{ userId: user._id }, { memberIds: user._id }] }).sort({ startDate: -1 }).lean();
  return NextResponse.json({
    trips: trips.map((t) => ({
      id: t._id.toString(),
      title: t.title,
      destination: t.destination,
      status: t.status,
      startDate: t.startDate,
      endDate: t.endDate,
      role: t.userId.toString() === user._id.toString() ? "admin" : "member",
      people: 1 + (t.memberIds?.length ?? 0),
    })),
  });
}
