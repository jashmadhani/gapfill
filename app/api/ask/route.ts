import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { getActivePlanForTrip, resolveCurrentTrip } from "@/lib/trip-helpers";
import type { ChatMessage } from "@/types";

/** Rule-based reply, not an LLM call - it reads the same trip/plan data a
 * real assistant would need, so swapping in a model later is a matter of
 * replacing this one function with a prompted call, not restructuring the
 * chat surface. */
function reply(text: string, tripTitle: string, spent: number, budget: number): string {
  const t = text.toLowerCase();
  if (t.includes("spend") || t.includes("cost") || t.includes("how much")) {
    return `You've spent ${spent.toLocaleString("en-IN")} of your ${budget.toLocaleString("en-IN")} budget on ${tripTitle} so far.`;
  }
  if (t.includes("rain") || t.includes("weather")) {
    return "Noted the weather - open the Trip tab and use “Report a change” so I can swap any outdoor plans for indoor ones.";
  }
  if (t.includes("late")) {
    return "Got it - tell me how many minutes and I can shift the rest of today's plan for you from the Trip tab.";
  }
  if (t.includes("coordinator") || t.includes("call")) {
    return "You can reach your coordinator directly from the Trip tab - look for the call button under “Your coordinator”.";
  }
  return `I can help with ${tripTitle}: ask me about spend, today's plan, or tell me if something changed (running late, weather, budget).`;
}

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await connectToDatabase();
  const tripId = req.nextUrl.searchParams.get("tripId");
  const trip = tripId
    ? await (await import("@/lib/models/trip.model")).TripModel.findOne({ _id: tripId, userId: user._id })
    : await resolveCurrentTrip(user._id.toString());

  if (!trip) return NextResponse.json({ trip: null, messages: [] });

  const plan = await getActivePlanForTrip(trip._id.toString());
  return NextResponse.json({
    trip: { id: trip._id.toString(), title: trip.title },
    messages: plan?.chatHistory ?? [],
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { tripId, text } = (await req.json()) as { tripId?: string; text: string };
  if (!text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });

  await connectToDatabase();
  const { TripModel } = await import("@/lib/models/trip.model");
  const trip = tripId
    ? await TripModel.findOne({ _id: tripId, userId: user._id })
    : await resolveCurrentTrip(user._id.toString());
  if (!trip) return NextResponse.json({ error: "No trip to ask about yet" }, { status: 404 });

  const plan = await getActivePlanForTrip(trip._id.toString());
  if (!plan) return NextResponse.json({ error: "No plan to ask about yet" }, { status: 404 });

  const now = new Date().toISOString();
  const userMsg: ChatMessage = { role: "user", text: text.trim(), at: now };
  const assistantMsg: ChatMessage = {
    role: "assistant",
    text: reply(text, trip.title, trip.totalSpent, trip.totalBudget),
    at: now,
  };
  plan.chatHistory.push(userMsg, assistantMsg);
  plan.markModified("chatHistory");
  await plan.save();

  return NextResponse.json({ messages: plan.chatHistory });
}
