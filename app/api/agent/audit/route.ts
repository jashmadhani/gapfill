import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentTrip } from "@/lib/trip-helpers";
import { AgentAuditModel } from "@/lib/models/agent-audit.model";

/** The assistant's gateway records every tool call here (secrets already redacted). Append-only. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = z.object({ action: z.string().max(60), detail: z.record(z.string(), z.unknown()).default({}), outcome: z.enum(["ok", "blocked", "error"]).default("ok") }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid audit entry" }, { status: 400 });
  await connectToDatabase();
  const trip = await resolveCurrentTrip(user._id.toString());
  await AgentAuditModel.create({ userId: user._id, tripId: trip?._id, actor: "agent", ...parsed.data });
  return NextResponse.json({ ok: true });
}
