import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import type { AdvisorySummary } from "@/types";

export interface AreaDoc {
  areaId: string;
  name: string;
  region: string;
  imageUrl?: string;
  advisorySummary?: AdvisorySummary;
}

export type AreaHydratedDocument = HydratedDocument<AreaDoc>;

const AreaSchema = new Schema<AreaDoc>({
  areaId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  region: { type: String, required: true },
  imageUrl: { type: String },
  advisorySummary: { type: Schema.Types.Mixed },
});

export const AreaModel: Model<AreaDoc> =
  mongoose.models.Area ?? mongoose.model<AreaDoc>("Area", AreaSchema);
