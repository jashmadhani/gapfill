import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { mintAgentServiceToken } from "@/lib/auth/agent-jwt";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8010";

const bodySchema = z.object({
  destination: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  budget: z.number().nonnegative().default(0),
  groupType: z.enum(["solo", "couple", "family", "large_group"]).default("solo"),
  themeTags: z.array(z.string()).default([]),
  members: z
    .array(z.object({ name: z.string().trim().min(1).max(40), age: z.number().int().min(0).max(110), stepFree: z.boolean().optional() }))
    .max(12)
    .default([]),
});

/** The Plan tab's form path: structured params in, a generated trip out.
 * Thin wrapper - the planning pipeline itself lives in agent-service. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "destination, startDate and endDate are required" }, { status: 400 });
  if (parsed.data.endDate < parsed.data.startDate) {
    return NextResponse.json({ error: "End date must be on or after the start date" }, { status: 400 });
  }

  const token = await mintAgentServiceToken(user._id.toString());
  try {
    const res = await fetch(`${AGENT_SERVICE_URL}/plan/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(90000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ error: data.detail || "Couldn't generate a plan" }, { status: res.status === 422 ? 422 : 502 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Plan generation call failed:", err);
    return NextResponse.json({ error: "The planning service is unavailable right now" }, { status: 502 });
  }
}
