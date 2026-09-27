import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import type {
  Currency,
  GroupType,
  PostTripSummary,
  TripChange,
  TripChecklistItem,
  TripCoordinator,
  TripGroup,
  TripLiveState,
  TripPayments,
  TripRisk,
  TripRouteStop,
  TripStatus,
  TripTimelineEvent,
} from "@/types";

export interface TripDoc {
  tripId: string;
  userId: mongoose.Types.ObjectId;

  title: string;
  code: string;
  destination: string;
  coverImageUrl?: string;
  route: TripRouteStop[];
  startDate: string;
  endDate: string;
  groupType: GroupType;
  group: TripGroup;
  themeTags: string[];

  totalBudget: number;
  totalSpent: number;
  currency: Currency;
  payments: TripPayments;

  status: TripStatus;
  liveState?: TripLiveState;

  coordinator?: TripCoordinator;
  checklist: TripChecklistItem[];
  risks: TripRisk[];
  changes: TripChange[];

  timeline: TripTimelineEvent[];
  postTripSummary?: PostTripSummary;

  createdAt: Date;
  updatedAt: Date;
}

export type TripHydratedDocument = HydratedDocument<TripDoc>;

const TripSchema = new Schema<Record<string, unknown>>(
  {
    tripId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    title: { type: String, required: true },
    code: { type: String, required: true },
    destination: { type: String, required: true },
    coverImageUrl: { type: String },
    route: { type: [Schema.Types.Mixed], default: [] },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    groupType: { type: String, default: "solo" },
    group: {
      type: Schema.Types.Mixed,
      default: () => ({ adults: 1, children: 0, members: [] }),
    },
    themeTags: { type: [String], default: [] },

    totalBudget: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    payments: {
      type: Schema.Types.Mixed,
      default: () => ({ total: 0, paid: 0, balance: 0 }),
    },

    status: { type: String, default: "planning", index: true },
    liveState: { type: Schema.Types.Mixed },

    coordinator: { type: Schema.Types.Mixed },
    checklist: { type: [Schema.Types.Mixed], default: [] },
    risks: { type: [Schema.Types.Mixed], default: [] },
    changes: { type: [Schema.Types.Mixed], default: [] },

    timeline: { type: [Schema.Types.Mixed], default: [] },
    postTripSummary: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const TripModel: Model<TripDoc> =
  mongoose.models.Trip ?? mongoose.model<TripDoc>("Trip", TripSchema);
