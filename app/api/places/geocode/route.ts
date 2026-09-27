import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { geocode } from "@/lib/places/geoapify";

/** Resolves a destination name to coordinates - the first step of both the
 * Plan tab's trip generator and any "attractions near X" lookup. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

  const result = await geocode(q);
  if (!result) return NextResponse.json({ error: "Could not find that place" }, { status: 404 });

  return NextResponse.json(result);
}
