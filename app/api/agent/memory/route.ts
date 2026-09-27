import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { ChatMemoryFactModel } from "@/lib/models/chat-memory.model";

/** Called by the agent's own `remember_fact` tool - never exposed to the
 * browser directly. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { fact, sessionId } = (await req.json()) as { fact?: string; sessionId?: string };
  if (typeof fact !== "string" || !fact.trim()) {
    return NextResponse.json({ error: "fact is required" }, { status: 400 });
  }

  await connectToDatabase();
  const doc = await ChatMemoryFactModel.create({ userId: user._id, fact: fact.trim(), sourceSessionId: sessionId });
  return NextResponse.json({ id: doc._id.toString(), fact: doc.fact }, { status: 201 });
}
