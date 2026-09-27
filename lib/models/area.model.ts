import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import type { AdvisorySummary } from "@/types";

export interface AreaDoc {
  areaId: string;
  name: string;
  region: string;
  imageUrl?: string;
  advisorySummary?: AdvisorySummary;
  // Added for the multi-city catalog: enough to draw a destination page and place it on a map.
  location?: { lat: number; lng: number };
  tagline?: string;
  description?: string;
  tags?: string[];
  idealNights?: number;
  bestMonths?: string;
  hasAirport?: boolean;
  hasRail?: boolean;
}

export type AreaHydratedDocument = HydratedDocument<AreaDoc>;

const AreaSchema = new Schema<AreaDoc>({
  areaId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  region: { type: String, required: true },
  imageUrl: { type: String },
  advisorySummary: { type: Schema.Types.Mixed },
  location: { type: new Schema({ lat: Number, lng: Number }, { _id: false }) },
  tagline: { type: String },
  description: { type: String },
  tags: { type: [String], default: [] },
  idealNights: { type: Number },
  bestMonths: { type: String },
  hasAirport: { type: Boolean },
  hasRail: { type: Boolean },
});

export const AreaModel: Model<AreaDoc> =
  mongoose.models.Area ?? mongoose.model<AreaDoc>("Area", AreaSchema);
