import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import type { ChatMessage, ChatSessionTag } from "@/types";

export interface ChatSessionDoc {
  sessionId: string;
  userId: mongoose.Types.ObjectId;
  title: string;
  tag: ChatSessionTag;
  planTripId?: mongoose.Types.ObjectId;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export type ChatSessionHydratedDocument = HydratedDocument<ChatSessionDoc>;

const ChatSessionSchema = new Schema<Record<string, unknown>>(
  {
    sessionId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "New chat" },
    tag: { type: String, enum: ["normal", "plan"], default: "normal" },
    planTripId: { type: Schema.Types.ObjectId, ref: "Trip" },
    messages: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

export const ChatSessionModel: Model<ChatSessionDoc> =
  mongoose.models.ChatSession ?? mongoose.model<ChatSessionDoc>("ChatSession", ChatSessionSchema);
