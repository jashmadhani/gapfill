import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { ChatSessionModel } from "@/lib/models/chat-session.model";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await connectToDatabase();
  const sessions = await ChatSessionModel.find({ userId: user._id }).sort({ updatedAt: -1 }).lean();

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.sessionId,
      title: s.title,
      updatedAt: s.updatedAt,
      lastMessage: s.messages.at(-1)?.content ?? "",
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await connectToDatabase();
  const session = await ChatSessionModel.create({
    sessionId: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: user._id,
    title: "New chat",
    messages: [],
  });

  return NextResponse.json({ id: session.sessionId, title: session.title }, { status: 201 });
}
