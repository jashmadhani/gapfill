import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentTrip } from "@/lib/trip-helpers";
import { accessFor } from "@/lib/group";

async function accessTrip(id: string, userId: string) {
  return (await accessFor(id, userId))?.trip ?? null;
}
import { OPEN, tripTotal } from "@/lib/payments";
import { getActivePlanForTrip } from "@/lib/trip-helpers";
import { PaymentIntentModel } from "@/lib/models/payment-intent.model";
import { TicketModel } from "@/lib/models/ticket.model";

/** Read-only view for the assistant: totals, whether an approval is waiting, and which tickets exist.
 * Never includes card, bank or provider details (we never hold them). */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await connectToDatabase();
  const explicit = req.nextUrl.searchParams.get("trip");
  const trip = explicit && explicit !== "current" ? await accessTrip(explicit, user._id.toString()) : await resolveCurrentTrip(user._id.toString());
  if (!trip) return NextResponse.json({ error: "No trip" }, { status: 404 });
  const plan = await getActivePlanForTrip(trip._id.toString());
  const isAdmin = trip.userId.toString() === user._id.toString();
  const open = isAdmin ? await PaymentIntentModel.find({ tripId: trip._id, status: { $in: OPEN } }).lean() : [];
  const tickets = await TicketModel.find({ tripId: trip._id }).lean();
  const t = plan ? tripTotal(trip, plan) : null;
  return NextResponse.json({
    tripId: trip._id.toString(),
    title: trip.title,
    status: trip.status,
    youAreAdmin: isAdmin,
    total: t?.total ?? trip.payments?.total ?? 0,
    paid: trip.payments?.paid ?? 0,
    balance: trip.status === "planning" ? (t?.total ?? 0) : (trip.payments?.balance ?? 0),
    approvalWaiting: open.map((i) => ({ kind: i.kind, amount: i.amount, title: i.summary.title })),
    tickets: tickets.map((k) => ({ title: k.title, startTime: k.startTime, status: k.status })),
  });
}
