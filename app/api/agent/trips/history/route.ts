import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { TripModel } from "@/lib/models/trip.model";

/** Backs the "how have my preferences changed" / "what did I do on my last
 * trip" asks - completed trips plus a cheap aggregate over theme tags and
 * budget adherence, rather than making the model re-derive that from a raw
 * trip list every time. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await connectToDatabase();
  const trips = await TripModel.find({ userId: user._id, status: "completed" }).sort({ endDate: -1 }).lean();

  const tagFrequency: Record<string, number> = {};
  let totalBudget = 0;
  let totalSpent = 0;
  for (const t of trips) {
    for (const tag of t.themeTags ?? []) tagFrequency[tag] = (tagFrequency[tag] ?? 0) + 1;
    totalBudget += t.totalBudget ?? 0;
    totalSpent += t.totalSpent ?? 0;
  }

  return NextResponse.json({
    trips: trips.map((t) => ({
      id: t._id.toString(),
      title: t.title,
      destination: t.destination,
      startDate: t.startDate,
      endDate: t.endDate,
      themeTags: t.themeTags,
      totalBudget: t.totalBudget,
      totalSpent: t.totalSpent,
      postTripSummary: t.postTripSummary ?? null,
    })),
    favoriteThemes: Object.entries(tagFrequency)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag),
    averageBudgetAdherencePct: trips.length && totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : null,
  });
}
