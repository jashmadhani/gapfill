import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import type { ConsideredPlace, EventCard, PlanConflict, PlanHotel, PlanStatus } from "@/types";

export interface PlanDoc {
  planId: string;
  tripId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;

  version: number;
  parentPlanId?: string;
  status: PlanStatus;

  days: EventCard[][];
  hotel?: PlanHotel;

  totalCost: number;
  narrative: string;
  changeReason?: string;
  alternatives: Record<string, unknown>[];
  conflicts: PlanConflict[];
  notes: string[];
  considered: ConsideredPlace[];

  createdAt: Date;
  modifiedAt: Date;
}

export type PlanHydratedDocument = HydratedDocument<PlanDoc>;

const PlanSchema = new Schema<Record<string, unknown>>(
  {
    planId: { type: String, required: true, unique: true },
    tripId: { type: Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    version: { type: Number, default: 1 },
    parentPlanId: { type: String },
    status: { type: String, default: "active", index: true },

    days: { type: [[Schema.Types.Mixed]], default: [] },
    hotel: { type: Schema.Types.Mixed },

    totalCost: { type: Number, default: 0 },
    narrative: { type: String, default: "" },
    changeReason: { type: String },
    alternatives: { type: [Schema.Types.Mixed], default: [] },
    conflicts: { type: [Schema.Types.Mixed], default: [] },
    notes: { type: [String], default: [] },
    considered: { type: [Schema.Types.Mixed], default: [] },

    modifiedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const PlanModel: Model<PlanDoc> =
  mongoose.models.PlanDocument ?? mongoose.model<PlanDoc>("PlanDocument", PlanSchema);
