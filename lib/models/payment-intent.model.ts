import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

export type IntentStatus = "proposed" | "awaiting_payment" | "paid" | "executed" | "cancelled" | "expired" | "stale";

export interface IntentLine {
  label: string;
  amount: number;
  strong?: boolean;
}

/** Every action that moves money starts as one of these. The AI can only create it (status "proposed");
 * approving and paying are the traveller's own taps. */
export interface PaymentIntentDoc {
  intentId: string;
  tripId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId; // the trip admin, the only person who can approve
  kind: "booking" | "balance";
  mode?: "deposit" | "full";
  amount: number;
  summary: { title: string; subtitle: string; lines: IntentLine[]; policy: string };
  /** Hash of the plan and amount at quote time; re-checked at approval and again before booking. */
  hash: string;
  status: IntentStatus;
  createdBy: "agent" | "traveller";
  providerRef?: string;
  paymentId?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentIntentHydrated = HydratedDocument<PaymentIntentDoc>;

const IntentSchema = new Schema<PaymentIntentDoc>(
  {
    intentId: { type: String, required: true, unique: true },
    tripId: { type: Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, required: true },
    mode: { type: String },
    amount: { type: Number, required: true },
    summary: { type: Schema.Types.Mixed, required: true },
    hash: { type: String, required: true },
    status: { type: String, default: "proposed", index: true },
    createdBy: { type: String, default: "traveller" },
    providerRef: { type: String },
    paymentId: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const PaymentIntentModel: Model<PaymentIntentDoc> = mongoose.models.PaymentIntent ?? mongoose.model<PaymentIntentDoc>("PaymentIntent", IntentSchema);
