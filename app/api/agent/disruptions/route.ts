import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { accessFor } from "@/lib/group";
import { resolveCurrentTrip } from "@/lib/trip-helpers";
import { ChangeEventModel } from "@/lib/models/change-event.model";

const change = z.object({ op: z.enum(["swap", "remove", "shift"]), itemId: z.string() }).passthrough();
const option = z.object({ key: z.string().max(2), label: z.string().max(120), summary: z.string().max(600), changes: z.array(change).max(20), fit: z.number(), costPerPerson: z.number(), lostMin: z.number(), score: z.number(), recommended: z.boolean() });
const body = z.object({
  tripId: z.string().nullish(),
  kind: z.enum(["weather", "running_late", "unavailable", "budget_change", "mood_change"]),
  label: z.string().max(60),
  reason: z.string().max(300),
  impact: z.array(z.string()).max(30),
  day: z.number().int().nullish(),
  options: z.array(option).min(1).max(4),
  source: z.string().max(30).default("traveller"),
});

async function tripFor(req: NextRequest, userId: string, tripId?: string | null) {
  if (tripId) return (await accessFor(tripId, userId))?.trip ?? null;
  return resolveCurrentTrip(userId);
}

/** The disruption engine stores what it prepared. Anyone on the trip can report a problem; only the admin decides. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid change event" }, { status: 400 });
  const trip = await tripFor(req, user._id.toString(), parsed.data.tripId);
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  // A newer report of the same kind for the same day replaces the older open one.
  await ChangeEventModel.updateMany({ tripId: trip._id, kind: parsed.data.kind, day: parsed.data.day ?? null, status: "pending" }, { status: "dismissed" });
  const { tripId: _omit, ...rest } = parsed.data;
  void _omit;
  const ev = await ChangeEventModel.create({ ...rest, tripId: trip._id, reportedBy: user._id });
  return NextResponse.json({ id: ev._id.toString() });
}

/** Pending changes on the current trip, for the assistant. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const explicit = req.nextUrl.searchParams.get("trip");
  const trip = explicit && explicit !== "current" ? await tripFor(req, user._id.toString(), explicit) : await resolveCurrentTrip(user._id.toString());
  if (!trip) return NextResponse.json({ changes: [] });
  const events = await ChangeEventModel.find({ tripId: trip._id, status: "pending" }).sort({ createdAt: -1 }).lean();
  return NextResponse.json({
    youAreAdmin: trip.userId.toString() === user._id.toString(),
    changes: events.map((e) => ({ id: e._id.toString(), label: e.label, reason: e.reason, day: e.day, options: e.options.map((o) => ({ key: o.key, label: o.label, summary: o.summary, fit: o.fit, costPerPerson: o.costPerPerson, lostMin: o.lostMin, recommended: o.recommended })) })),
  });
}
