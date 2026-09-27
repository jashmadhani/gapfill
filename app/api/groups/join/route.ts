import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { TripModel } from "@/lib/models/trip.model";
import { members, saveMembers } from "@/lib/group";

const schema = z.object({ code: z.string().trim().min(4).max(20), age: z.number().int().min(0).max(110).optional(), stepFree: z.boolean().optional() });

/** Join a friend's trip with its invite code (or link). The joiner becomes a member: they see the plan and can
 * suggest and vote, but only the admin can change it. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Sign in to join this trip" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter the invite code" }, { status: 400 });

  await connectToDatabase();
  const trip = await TripModel.findOne({ inviteCode: parsed.data.code.toUpperCase() });
  if (!trip) return NextResponse.json({ error: "That invite code doesn't match a trip" }, { status: 404 });

  const uid = user._id.toString();
  if (trip.userId.toString() === uid) return NextResponse.json({ tripId: trip._id.toString(), already: true });
  if (!trip.memberIds.some((m) => m.toString() === uid)) {
    if (trip.memberIds.length >= 11) return NextResponse.json({ error: "This trip is full (12 people)" }, { status: 409 });
    trip.memberIds.push(user._id);
    const list = members(trip);
    // Someone the admin already typed in by name can be claimed by the friend with the same name.
    const claim = list.find((m) => !m.userId && m.name.trim().toLowerCase() === user.name.trim().toLowerCase());
    if (claim) Object.assign(claim, { userId: uid, role: "member", age: parsed.data.age ?? claim.age, stepFree: parsed.data.stepFree ?? claim.stepFree });
    else list.push({ name: user.name, age: parsed.data.age ?? 30, stepFree: !!parsed.data.stepFree, interests: trip.themeTags, userId: uid, role: "member" });
    saveMembers(trip, list);
    await trip.save();
  }
  return NextResponse.json({ tripId: trip._id.toString() });
}
