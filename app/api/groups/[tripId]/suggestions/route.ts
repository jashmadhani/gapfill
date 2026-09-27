import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { requireUser } from "@/lib/auth/session";
import { accessFor } from "@/lib/group";

type Ctx = { params: Promise<{ tripId: string }> };

/** Anyone in the group suggests a place or idea; the admin decides. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { tripId } = await params;
  const access = await accessFor(tripId, user._id.toString());
  if (!access) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const parsed = z.object({ name: z.string().trim().min(2).max(80), note: z.string().trim().max(200).optional() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Tell us the place (2 to 80 characters)" }, { status: 400 });

  const { trip } = access;
  if ((trip.suggestions ?? []).length >= 60) return NextResponse.json({ error: "Too many open ideas. Ask the admin to clear some." }, { status: 409 });
  const id = randomBytes(4).toString("hex");
  trip.suggestions = [...(trip.suggestions ?? []), { id, userId: user._id.toString(), userName: user.name, name: parsed.data.name, note: parsed.data.note ?? "", status: "open", createdAt: new Date().toISOString() }];
  trip.markModified("suggestions");
  // The person who suggests it counts as its first vote.
  trip.votes = { ...(trip.votes ?? {}), [id]: [user._id.toString()] };
  trip.markModified("votes");
  await trip.save();
  return NextResponse.json({ id });
}

/** Admin only: mark an idea accepted (they will add it) or dismissed. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { tripId } = await params;
  const access = await accessFor(tripId, user._id.toString());
  if (!access) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  if (access.role !== "admin") return NextResponse.json({ error: "Only the trip admin can decide on suggestions" }, { status: 403 });
  const parsed = z.object({ id: z.string(), status: z.enum(["accepted", "dismissed", "open"]) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  const { trip } = access;
  trip.suggestions = (trip.suggestions ?? []).map((s) => (s.id === parsed.data.id ? { ...s, status: parsed.data.status } : s));
  trip.markModified("suggestions");
  await trip.save();
  return NextResponse.json({ ok: true });
}
