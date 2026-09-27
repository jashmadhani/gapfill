import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentTrip } from "@/lib/trip-helpers";
import { GateError, propose } from "@/lib/payments";

/** The only money route the assistant has: it PREPARES an approval card. It cannot approve, pay or refund. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = z.object({ kind: z.enum(["booking", "balance", "change"]).default("booking"), pay: z.enum(["deposit", "full"]).default("deposit"), changeId: z.string().optional(), option: z.string().max(2).optional() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  await connectToDatabase();
  const trip = await resolveCurrentTrip(user._id.toString());
  if (!trip) return NextResponse.json({ error: "No trip" }, { status: 404 });
  try {
    const change = parsed.data.kind === "change" && parsed.data.changeId && parsed.data.option ? { eventId: parsed.data.changeId, optionKey: parsed.data.option } : undefined;
    if (parsed.data.kind === "change" && !change) return NextResponse.json({ proposed: false, reason: "Say which change and option." });
    const intent = await propose(trip, user._id.toString(), parsed.data.kind, parsed.data.pay, "agent", change);
    return NextResponse.json({ proposed: true, amount: intent.amount, title: intent.summary.title, lines: intent.summary.lines, expiresInMinutes: 15, note: "Nothing has been charged. The traveller must review the card and approve it." });
  } catch (e) {
    if (e instanceof GateError) return NextResponse.json({ proposed: false, reason: e.message });
    throw e;
  }
}
