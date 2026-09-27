import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

export interface TicketDoc {
  tripId: mongoose.Types.ObjectId;
  itemId: string; // plan card this ticket admits to
  title: string;
  startTime: string;
  holders: number;
  /** Signed code: CODE.SIGNATURE. Only codes we signed verify, so a made-up or edited code is rejected. */
  code: string;
  status: "valid" | "void";
  createdAt: Date;
}

export type TicketHydrated = HydratedDocument<TicketDoc>;

const TicketSchema = new Schema<TicketDoc>(
  {
    tripId: { type: Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    itemId: { type: String, required: true },
    title: { type: String, required: true },
    startTime: { type: String, required: true },
    holders: { type: Number, default: 1 },
    code: { type: String, required: true, unique: true },
    status: { type: String, default: "valid" },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const TicketModel: Model<TicketDoc> = mongoose.models.Ticket ?? mongoose.model<TicketDoc>("Ticket", TicketSchema);
