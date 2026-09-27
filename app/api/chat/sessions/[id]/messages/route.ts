import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { mintAgentServiceToken } from "@/lib/auth/agent-jwt";
import { SECRET_WARNING, redact } from "@/lib/safety";
import { connectToDatabase } from "@/lib/db/mongoose";
import { ChatSessionModel } from "@/lib/models/chat-session.model";
import { agentChatRequestSchema, agentChatResponseSchema } from "@/lib/schemas/chat";
import { z } from "zod";

const planIntakeResponseSchema = z.object({
  reply: z.string(),
  complete: z.boolean(),
  tripId: z.string().nullable().optional(),
});

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8010";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const { text: rawText, context } = (await req.json()) as { text?: string; context?: string };
  if (!rawText?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });
  // Secrets are removed before the message is stored or the assistant sees it.
  const { text, found: secretsFound } = redact(rawText);

  await connectToDatabase();
  const session = await ChatSessionModel.findOne({ sessionId: id, userId: user._id });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const isPlanSession = session.tag === "plan";
  if (isPlanSession && session.planTripId) {
    return NextResponse.json({ error: "This plan chat is read-only - its trip has already been generated." }, { status: 400 });
  }

  const now = new Date().toISOString();
  session.messages.push({ role: "user", content: text.trim(), createdAt: now });
  if (session.title === "New chat" || session.title === "Plan a trip") session.title = text.trim().slice(0, 48);

  // Short-lived, single-purpose token: the agent service uses it both to
  // authenticate this call and to call back into /api/agent/* as this user.
  const token = await mintAgentServiceToken(user._id.toString());
  const request = agentChatRequestSchema.parse({
    message: text.trim(),
    history: [
      // Ephemeral steering for the agent only (e.g. "this chat is about trip X") - not persisted to the session.
      ...(context?.trim() ? [{ role: "system" as const, content: context.trim().slice(0, 500) }] : []),
      ...session.messages.slice(-16).map((m) => ({ role: m.role, content: m.content })),
    ],
  });

  if (isPlanSession) {
    let intake: z.infer<typeof planIntakeResponseSchema>;
    try {
      const res = await fetch(`${AGENT_SERVICE_URL}/plan/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(90000),
      });
      if (!res.ok) throw new Error(`Agent service returned ${res.status}`);
      intake = planIntakeResponseSchema.parse(await res.json());
    } catch (err) {
      console.error("Plan intake call failed:", err);
      intake = { reply: "I couldn't reach the planning service just now - please try again in a moment.", complete: false };
    }

    const navigate = intake.complete && intake.tripId ? { target: "plan" as const, reason: "Your trip is ready" } : undefined;
    session.messages.push({ role: "assistant", content: intake.reply, navigate, createdAt: new Date().toISOString() });
    if (intake.complete && intake.tripId) session.planTripId = intake.tripId as unknown as typeof session.planTripId;
    session.markModified("messages");
    await session.save();

    return NextResponse.json({
      messages: session.messages,
      navigate: navigate ?? null,
      planTripId: intake.complete ? (intake.tripId ?? null) : null,
      readOnly: !!session.planTripId,
    });
  }

  let agentReply;
  try {
    const res = await fetch(`${AGENT_SERVICE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Agent service returned ${res.status}`);
    agentReply = agentChatResponseSchema.parse(await res.json());
  } catch (err) {
    console.error("Agent service call failed:", err);
    agentReply = { reply: "I couldn't reach the assistant service just now — please try again in a moment.", navigate: null, toolCalls: [] };
  }

  session.messages.push({
    role: "assistant",
    content: secretsFound.length ? `${SECRET_WARNING}\n\n${agentReply.reply}` : agentReply.reply,
    toolCalls: agentReply.toolCalls,
    navigate: agentReply.navigate ?? undefined,
    createdAt: new Date().toISOString(),
  });
  session.markModified("messages");
  await session.save();

  return NextResponse.json({ messages: session.messages, navigate: agentReply.navigate ?? null });
}
