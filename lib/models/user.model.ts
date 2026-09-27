import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import type {
  AuthInfo,
  LastKnownLocation,
  LinkedAccount,
  UserPreferences,
} from "@/types";

/**
 * Mongoose's own document shape for User. Deliberately not `import { User }
 * from "@/types"` directly - Mongoose subdocuments/dates/ObjectIds don't
 * line up 1:1 with the wire-facing `User` interface (e.g. `_id` is an
 * ObjectId here, a string there). `toSafeUser` in lib/auth/session.ts is
 * the bridge between the two.
 */
export interface UserDoc {
  email: string;
  name: string;
  homeCity?: string;
  auth: AuthInfo;
  preferences: UserPreferences;
  phoneNumber?: string;
  lastKnownLocation?: LastKnownLocation;
  avatarUrl?: string;
  avatarImageKitFileId?: string;
  tripIds?: mongoose.Types.ObjectId[];
  savedPoiIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type UserHydratedDocument = HydratedDocument<UserDoc>;

const LinkedAccountSchema = new Schema<LinkedAccount>(
  {
    provider: { type: String, required: true },
    providerAccountId: { type: String, required: true },
    linkedAt: { type: String, required: true },
  },
  { _id: false }
);

const AuthInfoSchema = new Schema<AuthInfo>(
  {
    passwordHash: { type: String, select: false },
    linkedAccounts: { type: [LinkedAccountSchema], default: [] },
    emailVerified: { type: Boolean, default: false },
    lastLoginAt: { type: String },
  },
  { _id: false }
);

const UserPreferencesSchema = new Schema<UserPreferences>(
  {
    groupTypeDefault: { type: String, default: "solo" },
    dietary: { type: [String], default: [] },
    accessibilityFlags: { type: [String], default: [] },
    budgetSkew: { type: String, default: "on-budget" },
    preferredPace: { type: String, default: "moderate" },
    tagAffinities: { type: Schema.Types.Mixed, default: {} },
    travelerType: { type: [String], default: [] },
    homeCurrency: { type: String, default: "USD" },
  },
  { _id: false }
);

const LastKnownLocationSchema = new Schema<LastKnownLocation>(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracyM: { type: Number },
    recordedAt: { type: String, required: true },
    source: { type: String, required: true },
  },
  { _id: false }
);

const UserSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    homeCity: { type: String },
    auth: { type: AuthInfoSchema, required: true, default: () => ({ linkedAccounts: [], emailVerified: false }) },
    preferences: { type: UserPreferencesSchema, required: true, default: () => ({}) },
    phoneNumber: { type: String },
    lastKnownLocation: { type: LastKnownLocationSchema },
    avatarUrl: { type: String },
    avatarImageKitFileId: { type: String },
    tripIds: { type: [Schema.Types.ObjectId], ref: "Trip", default: [] },
    savedPoiIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

UserSchema.index({ "auth.linkedAccounts.provider": 1, "auth.linkedAccounts.providerAccountId": 1 });

export const UserModel: Model<UserDoc> =
  mongoose.models.User ?? mongoose.model<UserDoc>("User", UserSchema);
