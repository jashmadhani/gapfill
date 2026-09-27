import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

export type HotelTier = "budget" | "standard" | "premium" | "luxury";

export interface HotelDoc {
  areaId: mongoose.Types.ObjectId;
  areaKey: string;
  tier: HotelTier;
  name: string;
  pricePerNight: number;
  rating: number;
}

export type HotelHydratedDocument = HydratedDocument<HotelDoc>;

const HotelSchema = new Schema<HotelDoc>({
  areaId: { type: Schema.Types.ObjectId, ref: "Area", required: true, index: true },
  areaKey: { type: String, required: true, index: true },
  tier: { type: String, required: true },
  name: { type: String, required: true },
  pricePerNight: { type: Number, required: true },
  rating: { type: Number, default: 0 },
});
HotelSchema.index({ areaKey: 1, tier: 1 }, { unique: true });

export const HotelModel: Model<HotelDoc> = mongoose.models.Hotel ?? mongoose.model<HotelDoc>("Hotel", HotelSchema);
