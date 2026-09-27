import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { mintAgentServiceToken } from "@/lib/auth/agent-jwt";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8010";

/** Proxies the weather digital twin (agent-service/app/digital_twin.py) so the browser never needs the agent's
 * bearer token. GET returns every destination's live weather and risk; POST simulates a what-if scenario. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const token = await mintAgentServiceToken(user._id.toString());
  const res = await fetch(`${AGENT_SERVICE_URL}/digital-twin/overview`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) }).catch(() => null);
  if (!res || !res.ok) return NextResponse.json({ error: "The digital twin is unavailable right now" }, { status: 502 });
  return NextResponse.json(await res.json());
}

const sim = z.object({
  city: z.string().min(1),
  rain_mm: z.number().min(0).max(500).default(0),
  temp: z.number().min(-20).max(60).default(30),
  storm_duration_hrs: z.number().min(0).max(72).default(0),
  flood_level: z.enum(["None", "Low", "Moderate", "Severe"]).default("None"),
  wind_speed: z.number().min(0).max(250).default(10),
});

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = sim.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid simulation parameters" }, { status: 400 });
  const token = await mintAgentServiceToken(user._id.toString());
  const res = await fetch(`${AGENT_SERVICE_URL}/digital-twin/simulate`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(parsed.data), signal: AbortSignal.timeout(30000),
  }).catch(() => null);
  if (!res || !res.ok) return NextResponse.json({ error: "Simulation failed" }, { status: 502 });
  return NextResponse.json(await res.json());
}
