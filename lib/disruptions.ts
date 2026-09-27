import { randomBytes } from "node:crypto";
import type { TripHydratedDocument } from "@/lib/models/trip.model";
import type { PlanHydratedDocument } from "@/lib/models/plan.model";
import type { ChangeEventHydrated, ChangeOption } from "@/lib/models/change-event.model";
import { TicketModel } from "@/lib/models/ticket.model";
import { signTicket } from "@/lib/payments";

const shiftIso = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60000).toISOString();

/** People on the trip, for turning per-person price differences into what the group pays. */
export const people = (trip: TripHydratedDocument) => Math.max(1, (trip.group?.adults ?? 1) + (trip.group?.children ?? 0));

/** Apply one recovery option to the plan. For a booked trip, swapped-in stops are booked and ticketed and the
 * tickets for removed or replaced stops are voided. Returns the change in what the group owes (can be negative). */
export async function applyOption(trip: TripHydratedDocument, plan: PlanHydratedDocument, event: ChangeEventHydrated, option: ChangeOption) {
  const booked = trip.status === "upcoming" || trip.status === "active";
  const n = people(trip);
  const now = new Date().toISOString();
  let delta = 0;

  for (const ch of option.changes) {
    for (const day of plan.days) {
      const card = day.find((c) => c.itemId === ch.itemId && c.status !== "dismissed");
      if (!card) continue;
      if (ch.op === "shift" && ch.minutes) {
        card.startTime = shiftIso(card.startTime, ch.minutes);
        card.endTime = shiftIso(card.endTime, ch.minutes);
        continue;
      }
      if (booked) await TicketModel.updateMany({ tripId: trip._id, itemId: card.itemId }, { status: "void" });
      if (ch.op === "remove") {
        delta -= (card.typicalSpend || 0) * n;
        card.status = "dismissed";
        card.fitReason = ch.reason ?? card.fitReason;
        continue;
      }
      // swap: the card keeps its slot and takes the new place
      delta += ((ch.price ?? 0) - (card.typicalSpend || 0)) * n;
      const duration = ch.durationMin ?? card.durationMin;
      Object.assign(card, {
        poiId: ch.poiId,
        title: ch.title ?? card.title,
        typicalSpend: ch.price ?? card.typicalSpend,
        minExpectedSpend: Math.round((ch.price ?? card.typicalSpend) * 0.7),
        durationMin: duration,
        endTime: shiftIso(card.startTime, duration),
        location: ch.location ?? card.location,
        photoRef: ch.imageUrl ?? card.photoRef,
        fitReason: ch.reason ?? "Swapped in",
        memberFits: undefined,
        groupFit: undefined,
        status: booked ? "confirmed" : "suggested",
        booking: booked ? { bookingRef: `TC-${randomBytes(3).toString("hex").toUpperCase()}`, pricePaid: (ch.price ?? 0) * n, headCount: n, bookedAt: now } : undefined,
      });
      if (booked && (ch.price ?? 0) > 0) {
        await TicketModel.create({ tripId: trip._id, itemId: card.itemId, title: card.title, startTime: card.startTime, holders: n, code: signTicket(randomBytes(6).toString("hex").toUpperCase()) });
      }
    }
  }
  plan.totalCost = Math.max(0, (plan.totalCost ?? 0) + delta / n);
  plan.markModified("days");
  plan.modifiedAt = new Date();
  await plan.save();

  if (booked) {
    const total = Math.max(0, (trip.payments?.total ?? 0) + delta);
    trip.payments = { total, paid: trip.payments?.paid ?? 0, balance: total - (trip.payments?.paid ?? 0) };
    trip.markModified("payments");
  }
  trip.changes = [...(trip.changes ?? []), { id: event._id.toString(), label: `${event.label}: ${event.reason}`, status: option.changes.length ? "accepted" : "kept", chosenLabel: option.label }];
  trip.markModified("changes");
  await trip.save();

  event.status = "resolved";
  event.chosen = option.key;
  await event.save();
  return { delta };
}

/** What choosing this option costs the group now. Only a booked trip pays for changes; a draft just updates its price. */
export function optionCharge(trip: TripHydratedDocument, option: ChangeOption) {
  const booked = trip.status === "upcoming" || trip.status === "active";
  return booked ? Math.max(0, Math.round(option.costPerPerson * people(trip))) : 0;
}
