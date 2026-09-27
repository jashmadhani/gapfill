import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

export interface ChangeOp {
  op: "swap" | "remove" | "shift";
  itemId: string;
  from?: string;
  poiId?: string;
  title?: string;
  price?: number;
  durationMin?: number;
  location?: { lat: number; lng: number };
  imageUrl?: string | null;
  minutes?: number;
  reason?: string;
}

export interface ChangeOption {
  key: string;
  label: string;
  summary: string;
  changes: ChangeOp[];
  fit: number;
  costPerPerson: number;
  lostMin: number;
  score: number;
  recommended: boolean;
}

/** Something happened (rain, running late, a stop closed, a smaller budget, a mood check-in) and the disruption
 * engine prepared recovery options. Nothing changes until the trip admin picks one. */
export interface ChangeEventDoc {
  tripId: mongoose.Types.ObjectId;
  kind: "weather" | "running_late" | "unavailable" | "budget_change" | "mood_change";
  label: string;
  reason: string;
  impact: string[];
  day?: number | null;
  options: ChangeOption[];
  status: "pending" | "resolved" | "dismissed";
  chosen?: string;
  source: string;
  reportedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ChangeEventHydrated = HydratedDocument<ChangeEventDoc>;

const EventSchema = new Schema<Record<string, unknown>>(
  {
    tripId: { type: Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    kind: { type: String, required: true },
    label: { type: String, required: true },
    reason: { type: String, default: "" },
    impact: { type: [String], default: [] },
    day: { type: Number },
    options: { type: [Schema.Types.Mixed], default: [] },
    status: { type: String, default: "pending", index: true },
    chosen: { type: String },
    source: { type: String, default: "traveller" },
    reportedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const ChangeEventModel: Model<ChangeEventDoc> = mongoose.models.ChangeEvent ?? mongoose.model<ChangeEventDoc>("ChangeEvent", EventSchema);
