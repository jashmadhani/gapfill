import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { accessFor, ensureAdminMember, members, newInviteCode } from "@/lib/group";

type Ctx = { params: Promise<{ tripId: string }> };

/** The group as the caller may see it. Only the admin gets the invite code. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { tripId } = await params;
  const access = await accessFor(tripId, user._id.toString());
  if (!access) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const { trip, role } = access;

  if (role === "admin") {
    await ensureAdminMember(trip);
    if (!trip.inviteCode) trip.inviteCode = newInviteCode();
    if (trip.isModified()) await trip.save();
  }
  const me = user._id.toString();
  const votes = (trip.votes ?? {}) as Record<string, string[]>;
  return NextResponse.json({
    role,
    inviteCode: role === "admin" ? trip.inviteCode : undefined,
    members: members(trip).map((m) => ({ ...m, isMe: m.userId === me })),
    suggestions: (trip.suggestions ?? []).map((s) => ({ ...s, votes: (votes[String(s.id)] ?? []).length, iVoted: (votes[String(s.id)] ?? []).includes(me) })),
    votes: Object.fromEntries(Object.entries(votes).map(([k, v]) => [k, { count: v.length, iVoted: v.includes(me) }])),
  });
}
