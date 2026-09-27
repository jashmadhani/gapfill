import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { accessFor } from "@/lib/group";
import { GateError, OPEN, propose } from "@/lib/payments";
import { PaymentIntentModel } from "@/lib/models/payment-intent.model";
import { TicketModel } from "@/lib/models/ticket.model";

/** Cookie session only: payments are never reachable with the assistant's token. */
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const tripId = req.nextUrl.searchParams.get("tripId") ?? "";
  const access = await accessFor(tripId, user._id.toString());
  if (!access) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const tickets = await TicketModel.find({ tripId: access.trip._id }).sort({ startTime: 1 }).lean();
  // Approval cards and amounts are for the admin only; members just see the tickets.
  const intents =
    access.role === "admin"
      ? await PaymentIntentModel.find({ tripId: access.trip._id, status: { $in: OPEN } }).sort({ createdAt: -1 }).lean()
      : [];
  return NextResponse.json({
    role: access.role,
    intents: intents.map((i) => ({ id: i.intentId, kind: i.kind, mode: i.mode, amount: i.amount, summary: i.summary, status: i.status, createdBy: i.createdBy, expiresAt: i.expiresAt })),
    tickets: tickets.map((t) => ({ code: t.code, title: t.title, startTime: t.startTime, holders: t.holders, status: t.status })),
  });
}

/** The traveller's own "Book" tap: creates the same approval card the assistant would. */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = z.object({ tripId: z.string(), kind: z.enum(["booking", "balance"]).default("booking"), mode: z.enum(["deposit", "full"]).default("deposit") }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const access = await accessFor(parsed.data.tripId, user._id.toString());
  if (!access) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  try {
    const intent = await propose(access.trip, user._id.toString(), parsed.data.kind, parsed.data.mode, "traveller");
    return NextResponse.json({ id: intent.intentId });
  } catch (e) {
    if (e instanceof GateError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
