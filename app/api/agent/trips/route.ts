import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { TripModel } from "@/lib/models/trip.model";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await connectToDatabase();
  const status = req.nextUrl.searchParams.get("status");
  const query: Record<string, unknown> = { userId: user._id };
  if (status) query.status = status;

  const trips = await TripModel.find(query).sort({ startDate: -1 }).lean();

  return NextResponse.json({
    trips: trips.map((t) => ({
      id: t._id.toString(),
      title: t.title,
      destination: t.destination,
      status: t.status,
      startDate: t.startDate,
      endDate: t.endDate,
      themeTags: t.themeTags,
    })),
  });
}
