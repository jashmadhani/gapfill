import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

export interface ChatMemoryFactDoc {
  userId: mongoose.Types.ObjectId;
  fact: string;
  sourceSessionId?: string;
  createdAt: Date;
}

export type ChatMemoryFactHydratedDocument = HydratedDocument<ChatMemoryFactDoc>;

const ChatMemoryFactSchema = new Schema<ChatMemoryFactDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fact: { type: String, required: true },
    sourceSessionId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ChatMemoryFactModel: Model<ChatMemoryFactDoc> =
  mongoose.models.ChatMemoryFact ?? mongoose.model<ChatMemoryFactDoc>("ChatMemoryFact", ChatMemoryFactSchema);
