import { NextRequest, NextResponse } from "next/server";
import { requireUser, toSafeUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { TripModel } from "@/lib/models/trip.model";
import { resolveCurrentTrip } from "@/lib/trip-helpers";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await connectToDatabase();
  const userId = user._id.toString();
  const [tripsCount, currentTrip] = await Promise.all([
    TripModel.countDocuments({ userId }),
    resolveCurrentTrip(userId),
  ]);

  return NextResponse.json({
    user: toSafeUser(user),
    tripsCount,
    savedCount: (user.savedPoiIds ?? []).length,
    travelersCount: currentTrip?.group?.members?.length || 1,
  });
}

interface PatchBody {
  name?: string;
  homeCity?: string;
  preferences?: Partial<{
    groupTypeDefault: string;
    dietary: string[];
    budgetSkew: string;
    preferredPace: string;
    homeCurrency: string;
  }>;
}

export async function PATCH(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json()) as PatchBody;
  if (body.name) user.name = body.name;
  if (body.homeCity !== undefined) user.homeCity = body.homeCity;
  if (body.preferences) Object.assign(user.preferences, body.preferences);
  await user.save();

  return NextResponse.json({ user: toSafeUser(user) });
}
