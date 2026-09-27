import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ savedPoiIds: user.savedPoiIds ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { poiId } = await req.json();
  if (typeof poiId !== "string" || !poiId) {
    return NextResponse.json({ error: "poiId is required" }, { status: 400 });
  }

  const saved = new Set(user.savedPoiIds ?? []);
  if (saved.has(poiId)) saved.delete(poiId);
  else saved.add(poiId);
  user.savedPoiIds = [...saved];
  await user.save();

  return NextResponse.json({ savedPoiIds: user.savedPoiIds });
}
