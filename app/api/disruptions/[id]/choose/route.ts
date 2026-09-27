import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { ChangeEventModel } from "@/lib/models/change-event.model";
import { TripModel } from "@/lib/models/trip.model";
import { GateError, approve, propose } from "@/lib/payments";

type Ctx = { params: Promise<{ id: string }> };

/** The admin's own tap on an option. Goes through the payment gate: re-checked, applied, and charged only if it costs extra.
 * Cookie session only, so the assistant cannot call this. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const parsed = z.object({ option: z.string().max(2) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick an option" }, { status: 400 });
  const event = await ChangeEventModel.findById(id).catch(() => null);
  if (!event) return NextResponse.json({ error: "Change not found" }, { status: 404 });
  const trip = await TripModel.findById(event.tripId);
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const me = user._id.toString();
  if (trip.userId.toString() !== me) return NextResponse.json({ error: "Only the trip admin can apply changes. Vote or suggest instead." }, { status: 403 });
  try {
    const intent = await propose(trip, me, "change", "deposit", "traveller", { eventId: id, optionKey: parsed.data.option });
    return NextResponse.json(await approve(intent, me));
  } catch (e) {
    if (e instanceof GateError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
