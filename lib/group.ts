import { randomBytes } from "node:crypto";
import { connectToDatabase } from "@/lib/db/mongoose";
import { TripModel, type TripHydratedDocument } from "@/lib/models/trip.model";
import { UserModel } from "@/lib/models/user.model";
import type { TripGroupMember } from "@/types";

export type GroupRole = "admin" | "member";

/** Powers, in one place:
 *  admin  - change the plan (add, remove, lock, re-plan), invite and remove people, decide on suggestions
 *  member - see the live plan, edit their own details (age, step-free), suggest places, vote
 */
export interface GroupAccess {
  trip: TripHydratedDocument;
  role: GroupRole;
}

/** The trip as this person is allowed to see it, or null if they are neither its admin nor a member. */
export async function accessFor(tripId: string, userId: string): Promise<GroupAccess | null> {
  await connectToDatabase();
  const trip = await TripModel.findOne({ _id: tripId, $or: [{ userId }, { memberIds: userId }] }).catch(() => null);
  if (!trip) return null;
  return { trip, role: trip.userId.toString() === userId ? "admin" : "member" };
}

export const newInviteCode = () => randomBytes(5).toString("hex").toUpperCase();

export function members(trip: TripHydratedDocument): TripGroupMember[] {
  return ((trip.group?.members ?? []) as TripGroupMember[]).map((m) => ({ ...m }));
}

/** Admin's own entry in the group list, created on first use so they show up next to their friends. */
export async function ensureAdminMember(trip: TripHydratedDocument) {
  const list = members(trip);
  if (list.some((m) => m.userId === trip.userId.toString())) return;
  const admin = await UserModel.findById(trip.userId).lean();
  // If the admin already typed themselves in the traveller form (first entry), link that entry instead of duplicating it.
  const first = list.find((m) => !m.userId && m.name.trim().toLowerCase() === (admin?.name ?? "").trim().toLowerCase());
  if (first) {
    first.userId = trip.userId.toString();
    first.role = "admin";
  } else {
    list.unshift({ name: admin?.name ?? "Admin", age: 32, userId: trip.userId.toString(), role: "admin" });
  }
  saveMembers(trip, list);
}

export function saveMembers(trip: TripHydratedDocument, list: TripGroupMember[]) {
  trip.group = {
    adults: list.filter((m) => (m.age ?? 30) >= 18).length,
    children: list.filter((m) => (m.age ?? 30) < 18).length,
    members: list,
  };
  trip.markModified("group");
}
