import { createHash, createHmac, randomBytes } from "node:crypto";
import type mongoose from "mongoose";
import { TripModel, type TripHydratedDocument } from "@/lib/models/trip.model";
import type { PlanHydratedDocument } from "@/lib/models/plan.model";
import { PaymentIntentModel, type IntentStatus, type PaymentIntentHydrated } from "@/lib/models/payment-intent.model";
import { TicketModel } from "@/lib/models/ticket.model";
import { AgentAuditModel } from "@/lib/models/agent-audit.model";
import { getActivePlanForTrip } from "@/lib/trip-helpers";
import { ChangeEventModel } from "@/lib/models/change-event.model";
import { applyOption, optionCharge } from "@/lib/disruptions";
import type { EventCard } from "@/types";

/**
 * The payment gate (human in the loop). Deterministic code, not AI.
 *
 *   propose  -> quote the exact amount, lock the plan and amount into a hash, expire in 15 minutes
 *   approve  -> only the trip admin's own tap, from a signed-in browser session (never the agent's token)
 *   pay      -> the traveller pays on the provider's page; we receive only a verified payment id
 *   execute  -> re-check the hash again, then confirm the bookings and issue tickets
 *
 * If the plan or the price changes at any point the intent goes "stale" and nothing is booked. The assistant can only
 * call `propose`; there is no code path from the agent to approve, pay, refund or read payment details.
 *
 * Payments run in sandbox mode: the "provider page" is /pay/<id>, no real money moves, and swapping in a live
 * provider (e.g. Razorpay) only replaces checkout() and verify() below.
 */
export const DEPOSIT = 0.3;
export const EXPIRY_MS = 15 * 60 * 1000;
export const OPEN: IntentStatus[] = ["proposed", "awaiting_payment"];

export class GateError extends Error {}

/** Hard ceiling on any single payment the assistant may even propose. */
export const maxProposal = () => Number(process.env.AGENT_MAX_PROPOSAL || 500000);

const liveCards = (plan: PlanHydratedDocument): EventCard[] => plan.days.flat().filter((c) => c.status !== "dismissed");
const headcount = (trip: TripHydratedDocument) => Math.max(1, (trip.group?.adults ?? 1) + (trip.group?.children ?? 0));

export function tripTotal(trip: TripHydratedDocument, plan: PlanHydratedDocument) {
  const perPerson = liveCards(plan).reduce((s, c) => s + (c.typicalSpend || 0), 0);
  return { perPerson, people: headcount(trip), total: Math.round(perPerson * headcount(trip)) };
}

function planHash(trip: TripHydratedDocument, plan: PlanHydratedDocument, kind: string, mode: string | undefined, amount: number, extra = "") {
  const items = liveCards(plan)
    .map((c) => [c.itemId, c.status, c.typicalSpend, c.startTime])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return createHash("sha256").update(JSON.stringify({ trip: [trip._id.toString(), trip.status], items, kind, mode, amount, extra })).digest("hex");
}

const line = (label: string, amount: number, strong = false) => ({ label, amount: Math.round(amount), strong });

/** Work out exactly what an action costs, without changing anything. */
export async function quote(trip: TripHydratedDocument, kind: "booking" | "balance" | "change", mode: "deposit" | "full" = "deposit", change?: { eventId: string; optionKey: string }) {
  const plan = await getActivePlanForTrip(trip._id.toString());
  if (!plan) throw new GateError("This trip has no plan yet.");
  const t = tripTotal(trip, plan);

  if (kind === "change") {
    const event = change && (await ChangeEventModel.findOne({ _id: change.eventId, tripId: trip._id }).catch(() => null));
    if (!event || event.status !== "pending") throw new GateError("That change is no longer waiting for a decision.");
    const option = event.options.find((o) => o.key === change!.optionKey);
    if (!option) throw new GateError("Unknown option.");
    const amount = optionCharge(trip, option);
    const refund = option.costPerPerson < 0 && trip.status !== "planning" ? Math.round(-option.costPerPerson * Math.max(1, t.people)) : 0;
    return {
      plan,
      amount,
      hash: planHash(trip, plan, kind, undefined, amount, `${change!.eventId}:${change!.optionKey}`),
      summary: {
        title: `${event.label}: ${option.label}`,
        subtitle: option.summary,
        lines: [
          line("Predicted group fit", option.fit),
          ...(amount > 0 ? [line("Extra to pay now", amount, true)] : refund > 0 ? [line("Comes off your balance", refund, true)] : [line("No extra cost", 0, true)]),
        ],
        policy: option.changes.length ? "Replaced or removed stops have their tickets voided; new stops are booked and ticketed." : "Nothing in the plan changes.",
      },
    };
  }

  if (kind === "booking") {
    if (trip.status !== "planning") throw new GateError("This trip is already booked.");
    if (!liveCards(plan).some((c) => c.type === "activity")) throw new GateError("Add at least one activity before booking.");
    const amount = mode === "full" ? t.total : Math.round(t.total * DEPOSIT);
    if (amount <= 0) throw new GateError("Nothing to pay yet: the plan has no priced stops.");
    const bookings = liveCards(plan).filter((c) => c.type === "activity" && c.typicalSpend > 0).length;
    return {
      plan,
      amount,
      hash: planHash(trip, plan, kind, mode, amount),
      summary: {
        title: `Book ${trip.title}`,
        subtitle: `${bookings} bookings · ${t.people} traveller${t.people === 1 ? "" : "s"}`,
        lines: [
          line(`Per person (${t.people} travelling)`, t.perPerson),
          line("Trip total", t.total),
          line(mode === "deposit" ? "Pay now, 30% deposit" : "Pay now, in full", amount, true),
          ...(mode === "deposit" ? [line("Balance due before the trip", t.total - amount)] : []),
        ],
        policy: "Tickets are issued once payment is confirmed. Each booking keeps its own free-cancellation window.",
      },
    };
  }

  if (trip.status !== "upcoming") throw new GateError("Only a booked trip has a balance.");
  const balance = Math.max(0, (trip.payments?.balance ?? 0));
  if (balance <= 0) throw new GateError("Nothing is due: the trip is fully paid.");
  return {
    plan,
    amount: balance,
    hash: planHash(trip, plan, kind, undefined, balance),
    summary: {
      title: "Pay the balance",
      subtitle: trip.title,
      lines: [line("Trip total", trip.payments.total), line("Paid so far", trip.payments.paid), line("Pay now", balance, true)],
      policy: "Paying the balance doesn't change any booking or cancellation window.",
    },
  };
}

type Id = mongoose.Types.ObjectId | string;
export async function audit(userId: Id, tripId: Id | undefined, actor: "agent" | "traveller" | "system", action: string, detail: Record<string, unknown> = {}, outcome: "ok" | "blocked" | "error" = "ok", intentId?: string) {
  await AgentAuditModel.create({ userId, tripId, actor, action, detail, outcome, intentId });
}

/** Create an approval card. Nothing is charged, booked or refunded until the admin approves and pays. */
export async function propose(trip: TripHydratedDocument, userId: string, kind: "booking" | "balance" | "change", mode: "deposit" | "full", createdBy: "agent" | "traveller", change?: { eventId: string; optionKey: string }) {
  if (trip.userId.toString() !== userId) throw new GateError("Only the trip admin can book, pay for or change this trip.");
  const q = await quote(trip, kind, mode, change);
  if (createdBy === "agent" && q.amount > maxProposal()) throw new GateError("That amount is above what the assistant may prepare. Please use the Book button yourself.");
  // One live card at a time: a new proposal replaces an older open one.
  await PaymentIntentModel.updateMany({ tripId: trip._id, status: { $in: OPEN } }, { status: "cancelled" });
  const intent = await PaymentIntentModel.create({
    intentId: `pi_${randomBytes(6).toString("hex")}`,
    tripId: trip._id,
    userId: trip.userId,
    kind,
    mode: kind === "booking" ? mode : undefined,
    eventId: change?.eventId,
    optionKey: change?.optionKey,
    amount: q.amount,
    summary: q.summary,
    hash: q.hash,
    createdBy,
    expiresAt: new Date(Date.now() + EXPIRY_MS),
  });
  await audit(trip.userId, trip._id, createdBy === "agent" ? "agent" : "traveller", "propose", { kind, mode, amount: q.amount }, "ok", intent.intentId);
  return intent;
}

async function freshOrFail(intent: PaymentIntentHydrated, trip: TripHydratedDocument) {
  if (intent.expiresAt.getTime() < Date.now()) {
    intent.status = "expired";
    await intent.save();
    throw new GateError("This approval expired. Ask for a new one.");
  }
  const q = await quote(trip, intent.kind, intent.mode ?? "deposit", intent.eventId && intent.optionKey ? { eventId: intent.eventId, optionKey: intent.optionKey } : undefined).catch(() => null);
  if (!q || q.hash !== intent.hash) {
    intent.status = "stale";
    await intent.save();
    await audit(intent.userId, intent.tripId, "system", "stale", { reason: "plan or price changed" }, "blocked", intent.intentId);
    throw new GateError("The plan or the price changed after this was quoted, so nothing was charged. Please review the trip and try again.");
  }
  return q;
}

/** The admin's own tap: re-check, then send them to the provider's checkout. */
export async function approve(intent: PaymentIntentHydrated, userId: string) {
  if (intent.userId.toString() !== userId) throw new GateError("Only the trip admin can approve this.");
  if (intent.status !== "proposed") throw new GateError("This approval is no longer open.");
  const trip = await TripModel.findById(intent.tripId);
  if (!trip) throw new GateError("Trip not found.");
  await freshOrFail(intent, trip);
  if (intent.amount === 0) {
    intent.status = "awaiting_payment";
    await intent.save();
    await completePayment(intent, userId);
    return { checkoutUrl: null, applied: true };
  }
  intent.status = "awaiting_payment";
  intent.providerRef = `sbx_${randomBytes(8).toString("hex")}`;
  await intent.save();
  await audit(userId, intent.tripId, "traveller", "approve", { amount: intent.amount }, "ok", intent.intentId);
  return { checkoutUrl: `/pay/${intent.intentId}` };
}

const ticketSecret = () => process.env.TICKET_SECRET || createHash("sha256").update(`tickets:${process.env.AUTH_SECRET ?? "dev"}`).digest("hex");
export const signTicket = (id: string) => `${id}.${createHmac("sha256", ticketSecret()).update(id).digest("hex").slice(0, 12)}`;
export function verifyTicketCode(code: string) {
  const [id, sig] = code.split(".");
  return !!id && !!sig && signTicket(id) === code;
}

/** The provider confirmed payment. Re-check once more, then book and issue tickets. */
export async function completePayment(intent: PaymentIntentHydrated, userId: string) {
  if (intent.userId.toString() !== userId) throw new GateError("Only the trip admin can pay for this.");
  if (intent.status !== "awaiting_payment") throw new GateError("This payment isn't open.");
  const trip = await TripModel.findById(intent.tripId);
  if (!trip) throw new GateError("Trip not found.");
  const q = await freshOrFail(intent, trip);
  const plan = q.plan;
  if (intent.amount > 0) intent.paymentId = `pay_sbx_${randomBytes(8).toString("hex")}`;
  intent.status = "paid";
  await intent.save();

  const tickets: string[] = [];
  if (intent.kind === "change") {
    const event = await ChangeEventModel.findById(intent.eventId);
    const option = event?.options.find((o) => o.key === intent.optionKey);
    if (!event || !option) throw new GateError("That change is no longer available.");
    await applyOption(trip, plan, event, option);
    if (intent.amount > 0) {
      trip.payments = { ...trip.payments, paid: (trip.payments?.paid ?? 0) + intent.amount, balance: (trip.payments?.balance ?? 0) - intent.amount };
      trip.totalSpent = (trip.totalSpent ?? 0) + intent.amount;
    }
  } else if (intent.kind === "booking") {
    const t = tripTotal(trip, plan);
    const now = new Date().toISOString();
    for (const card of plan.days.flat()) {
      if (card.status === "dismissed" || (card.type !== "activity" && card.type !== "meal")) continue;
      card.status = "confirmed";
      card.booking = { bookingRef: `TC-${randomBytes(3).toString("hex").toUpperCase()}`, pricePaid: Math.round((card.typicalSpend || 0) * t.people), headCount: t.people, bookedAt: now };
      if (card.type === "activity" && card.typicalSpend > 0) {
        const code = signTicket(randomBytes(6).toString("hex").toUpperCase());
        await TicketModel.create({ tripId: trip._id, itemId: card.itemId, title: card.title, startTime: card.startTime, holders: t.people, code });
        tickets.push(code);
      }
    }
    plan.markModified("days");
    plan.modifiedAt = new Date();
    await plan.save();
    trip.status = "upcoming";
    trip.payments = { total: t.total, paid: intent.amount, balance: t.total - intent.amount };
    trip.totalSpent = intent.amount;
  } else if (intent.kind === "balance") {
    trip.payments = { ...trip.payments, paid: trip.payments.total, balance: 0 };
    trip.totalSpent = trip.payments.total;
  }
  trip.markModified("payments");
  await trip.save();
  intent.status = "executed";
  await intent.save();
  await audit(userId, trip._id, "system", "executed", { kind: intent.kind, amount: intent.amount, tickets: tickets.length }, "ok", intent.intentId);
  return { tickets: tickets.length };
}
