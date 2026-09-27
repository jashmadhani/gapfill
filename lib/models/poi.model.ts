import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import type {
  AccessibilityAttributes,
  AdvisoryNote,
  CostRange,
  CrowdProfileEntry,
  DwellTime,
  GeoPoint,
  GroupType,
  IndoorOutdoor,
  WeeklyOpeningHours,
} from "@/types";

export interface PoiBookable {
  vendorId?: mongoose.Types.ObjectId;
  pricePerHead: number;
  durationMin: number;
  capacityLeft: number;
}

export interface PoiDoc {
  poiId: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  activityType: string;
  location: GeoPoint;
  geo: { type: "Point"; coordinates: [number, number] };
  locationKey?: string;
  areaId?: mongoose.Types.ObjectId;
  imageUrl?: string;

  openingHours: WeeklyOpeningHours;
  typicalDwellMin: DwellTime;
  indoorOutdoor: IndoorOutdoor;
  groupSuitability: GroupType[];
  accessibilityAttributes: AccessibilityAttributes;

  cost: CostRange;
  bookable?: PoiBookable;

  crowdProfile: CrowdProfileEntry[];
  advisoryNotes: AdvisoryNote[];

  reviewCount: number;
  ratingAvg: number;
  trustScore: number;
  trustMeta: Record<string, unknown>;
  computedQualityScore?: number;

  /** Traveller-fit inputs kept from the curated catalog (intensity, stairs, walking km, seating,
   * shade, minimum age, popularity, best time, closed weekdays, kid-friendly). Used to explain
   * why a place suits or doesn't suit each person in a group. */
  attrs?: Record<string, unknown>;
  vendorName?: string;

  source: "vendor" | "google_places" | "wikimedia" | "seed" | "manual";
  createdAt: Date;
  updatedAt: Date;
}

export type PoiHydratedDocument = HydratedDocument<PoiDoc>;

const GeoPointSchema = new Schema<GeoPoint>({ lat: Number, lng: Number }, { _id: false });

const PoiSchema = new Schema<Record<string, unknown>>(
  {
    poiId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, default: "" },
    tags: { type: [String], default: [] },
    activityType: { type: String, default: "" },
    location: { type: GeoPointSchema, required: true },
    geo: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },
    locationKey: { type: String },
    areaId: { type: Schema.Types.ObjectId, ref: "Area" },
    imageUrl: { type: String },

    openingHours: { type: Schema.Types.Mixed, default: {} },
    typicalDwellMin: { type: Schema.Types.Mixed, default: { min: 30, typical: 60, max: 120 } },
    indoorOutdoor: { type: String, default: "mixed" },
    groupSuitability: { type: [String], default: ["solo", "couple", "family", "large_group"] },
    accessibilityAttributes: {
      type: Schema.Types.Mixed,
      default: { step_free: false, seating_available: false, restroom_onsite: false, sensory_friendly: false },
    },

    cost: { type: Schema.Types.Mixed, required: true },
    bookable: {
      type: new Schema<PoiBookable>(
        {
          vendorId: { type: Schema.Types.ObjectId, ref: "Vendor" },
          pricePerHead: Number,
          durationMin: Number,
          capacityLeft: Number,
        },
        { _id: false }
      ),
    },

    crowdProfile: { type: [Schema.Types.Mixed], default: [] },
    advisoryNotes: { type: [Schema.Types.Mixed], default: [] },

    reviewCount: { type: Number, default: 0 },
    ratingAvg: { type: Number, default: 0 },
    trustScore: { type: Number, default: 0 },
    trustMeta: { type: Schema.Types.Mixed, default: {} },
    computedQualityScore: { type: Number },
    attrs: { type: Schema.Types.Mixed, default: {} },
    vendorName: { type: String },

    source: { type: String, default: "seed" },
  },
  { timestamps: true }
);

PoiSchema.index({ geo: "2dsphere" });
PoiSchema.index({ tags: 1 });
PoiSchema.index({ areaId: 1 });

export const PoiModel: Model<PoiDoc> =
  mongoose.models.POI ?? mongoose.model<PoiDoc>("POI", PoiSchema);
