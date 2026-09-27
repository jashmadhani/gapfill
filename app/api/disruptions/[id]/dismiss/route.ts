import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { ChangeEventModel } from "@/lib/models/change-event.model";
import { TripModel } from "@/lib/models/trip.model";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const event = await ChangeEventModel.findById(id).catch(() => null);
  if (!event) return NextResponse.json({ error: "Change not found" }, { status: 404 });
  const trip = await TripModel.findById(event.tripId);
  if (!trip || trip.userId.toString() !== user._id.toString()) return NextResponse.json({ error: "Only the trip admin can dismiss changes" }, { status: 403 });
  event.status = "dismissed";
  await event.save();
  return NextResponse.json({ ok: true });
}
