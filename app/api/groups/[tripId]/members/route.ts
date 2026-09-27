import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { UserModel } from "@/lib/models/user.model";
import { accessFor, ensureAdminMember, members, saveMembers } from "@/lib/group";

type Ctx = { params: Promise<{ tripId: string }> };

/** Admin adds a friend who already has an account, by email. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { tripId } = await params;
  const access = await accessFor(tripId, user._id.toString());
  if (!access) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  if (access.role !== "admin") return NextResponse.json({ error: "Only the trip admin can add people" }, { status: 403 });

  const parsed = z.object({ email: z.string().trim().toLowerCase().email() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  const friend = await UserModel.findOne({ email: parsed.data.email });
  if (!friend) return NextResponse.json({ error: "No account with that email yet. Share the invite link and they can join after signing up." }, { status: 404 });

  const { trip } = access;
  if (friend._id.equals(trip.userId) || trip.memberIds.some((m) => m.equals(friend._id))) return NextResponse.json({ error: "They're already in this trip" }, { status: 409 });
  if (trip.memberIds.length >= 11) return NextResponse.json({ error: "This trip is full (12 people)" }, { status: 409 });
  await ensureAdminMember(trip);
  trip.memberIds.push(friend._id);
  const list = members(trip);
  list.push({ name: friend.name, age: 30, interests: trip.themeTags, userId: friend._id.toString(), role: "member" });
  saveMembers(trip, list);
  await trip.save();
  return NextResponse.json({ ok: true, name: friend.name });
}

/** Admin removes someone, or a member leaves (userId = their own). */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { tripId } = await params;
  const access = await accessFor(tripId, user._id.toString());
  if (!access) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const target = req.nextUrl.searchParams.get("userId") ?? "";
  const me = user._id.toString();
  if (access.role !== "admin" && target !== me) return NextResponse.json({ error: "Only the trip admin can remove people" }, { status: 403 });
  const { trip } = access;
  if (target === trip.userId.toString()) return NextResponse.json({ error: "The admin can't be removed" }, { status: 400 });
  trip.memberIds = trip.memberIds.filter((m) => m.toString() !== target);
  saveMembers(trip, members(trip).filter((m) => m.userId !== target));
  await trip.save();
  return NextResponse.json({ ok: true });
}
