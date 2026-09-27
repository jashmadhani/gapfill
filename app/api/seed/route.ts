import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { ensureDemoTripForUser } from "@/lib/seed";
import { toSafeTrip } from "@/lib/serialize";

/** Dev/demo convenience: populates the shared destination catalog once, and
 * gives the calling user a first trip so Trip/Plan/Ask never open cold. Safe
 * to call repeatedly - every step is idempotent. */
export async function POST() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const trip = await ensureDemoTripForUser(user._id.toString());
  return NextResponse.json({ trip: toSafeTrip(trip) });
}
