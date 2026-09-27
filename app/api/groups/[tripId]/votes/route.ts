import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { accessFor } from "@/lib/group";

type Ctx = { params: Promise<{ tripId: string }> };

/** Toggle your vote on a suggestion or on a place the planner left out. Everyone in the group can vote. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { tripId } = await params;
  const access = await accessFor(tripId, user._id.toString());
  if (!access) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const parsed = z.object({ key: z.string().min(1).max(120) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nothing to vote on" }, { status: 400 });

  const { trip } = access;
  const me = user._id.toString();
  const votes = { ...((trip.votes ?? {}) as Record<string, string[]>) };
  const has = (votes[parsed.data.key] ?? []).includes(me);
  votes[parsed.data.key] = has ? votes[parsed.data.key].filter((v) => v !== me) : [...(votes[parsed.data.key] ?? []), me];
  trip.votes = votes;
  trip.markModified("votes");
  await trip.save();
  return NextResponse.json({ count: votes[parsed.data.key].length, iVoted: !has });
}
