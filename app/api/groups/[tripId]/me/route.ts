import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { accessFor, ensureAdminMember, members, saveMembers } from "@/lib/group";

type Ctx = { params: Promise<{ tripId: string }> };
const schema = z.object({ age: z.number().int().min(0).max(110).optional(), stepFree: z.boolean().optional(), interests: z.array(z.string()).max(12).optional() });

/** Everyone can edit their own details. These feed the per-person fit the next time the plan is built. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { tripId } = await params;
  const access = await accessFor(tripId, user._id.toString());
  if (!access) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid details" }, { status: 400 });

  const { trip } = access;
  if (access.role === "admin") await ensureAdminMember(trip);
  const list = members(trip);
  const mine = list.find((m) => m.userId === user._id.toString());
  if (!mine) return NextResponse.json({ error: "You're not in this trip's group" }, { status: 404 });
  Object.assign(mine, parsed.data);
  saveMembers(trip, list);
  await trip.save();
  return NextResponse.json({ ok: true });
}
