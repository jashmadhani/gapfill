import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { mintAgentServiceToken } from "@/lib/auth/agent-jwt";
import { accessFor } from "@/lib/group";
import { ChangeEventModel } from "@/lib/models/change-event.model";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8010";

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const access = await accessFor(req.nextUrl.searchParams.get("tripId") ?? "", user._id.toString());
  if (!access) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const events = await ChangeEventModel.find({ tripId: access.trip._id, status: "pending" }).sort({ createdAt: -1 }).lean();
  return NextResponse.json({
    role: access.role,
    changes: events.map((e) => ({ id: e._id.toString(), kind: e.kind, label: e.label, reason: e.reason, impact: e.impact, day: e.day, options: e.options, createdAt: e.createdAt })),
  });
}

const trigger = z.object({
  tripId: z.string(),
  type: z.enum(["weather", "running_late", "unavailable", "budget_change"]),
  day: z.number().int().min(1).max(60).optional(),
  minutes: z.number().int().min(5).max(600).optional(),
  fromTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  itemId: z.string().optional(),
  budget: z.number().positive().optional(),
});

/** Report a disruption from the app (anyone on the trip). The engine in agent-service prepares the options. */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = trigger.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  const access = await accessFor(parsed.data.tripId, user._id.toString());
  if (!access) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const token = await mintAgentServiceToken(user._id.toString());
  try {
    const res = await fetch(`${AGENT_SERVICE_URL}/disruptions/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(60000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ error: data.detail || "Couldn't analyse that" }, { status: 502 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "The planning service is unavailable right now" }, { status: 502 });
  }
}
