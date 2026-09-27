import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { ChatSessionModel } from "@/lib/models/chat-session.model";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  const session = await ChatSessionModel.findOne({ sessionId: id, userId: user._id }).lean();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  return NextResponse.json({ id: session.sessionId, title: session.title, messages: session.messages });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  await ChatSessionModel.deleteOne({ sessionId: id, userId: user._id });
  return NextResponse.json({ ok: true });
}
