import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { TicketModel } from "@/lib/models/ticket.model";
import { verifyTicketCode } from "@/lib/payments";

/** Entry check for a vendor: is this code one we signed, and is it still valid? Returns no personal data. */
export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get("code") ?? "").trim();
  if (!verifyTicketCode(code)) return NextResponse.json({ valid: false, reason: "Not a Toure ticket" });
  await connectToDatabase();
  const t = await TicketModel.findOne({ code }).lean();
  if (!t) return NextResponse.json({ valid: false, reason: "Ticket not found" });
  return NextResponse.json({ valid: t.status === "valid", status: t.status, title: t.title, startTime: t.startTime, holders: t.holders });
}
