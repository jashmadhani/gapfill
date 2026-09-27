import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { TripModel } from "@/lib/models/trip.model";
import { ChatMemoryFactModel } from "@/lib/models/chat-memory.model";
import { resolveCurrentTrip } from "@/lib/trip-helpers";

/** Agent-facing profile: deliberately excludes email, phone, avatarUrl, and
 * everything under `auth` - the assistant should be able to talk about the
 * user's travel taste without ever seeing their account/auth data. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await connectToDatabase();
  const userId = user._id.toString();
  const [tripsCount, currentTrip, memoryFacts] = await Promise.all([
    TripModel.countDocuments({ userId }),
    resolveCurrentTrip(userId),
    ChatMemoryFactModel.find({ userId }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  return NextResponse.json({
    firstName: user.name.split(" ")[0],
    homeCity: user.homeCity || null,
    preferences: user.preferences,
    tripsCount,
    savedCount: (user.savedPoiIds ?? []).length,
    travelersCount: currentTrip?.group?.members?.length || 1,
    rememberedFacts: memoryFacts.map((f) => f.fact),
  });
}
