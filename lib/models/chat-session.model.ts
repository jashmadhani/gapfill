import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import type { ChatMessage, ChatSessionTag } from "@/types";

export interface ChatSessionDoc {
  sessionId: string;
  userId: mongoose.Types.ObjectId;
  title: string;
  tag: ChatSessionTag;
  planTripId?: mongoose.Types.ObjectId;
  /** Which trip this chat acts on. Set when opened from a trip's own page, or picked in the chat header;
   * every booking/mood/disruption tool call in this session resolves "current trip" to this one. */
  boundTripId?: mongoose.Types.ObjectId;
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
    tag: { type: String, enum: ["normal", "plan", "booking"], default: "normal" },
    planTripId: { type: Schema.Types.ObjectId, ref: "Trip" },
    boundTripId: { type: Schema.Types.ObjectId, ref: "Trip" },
    messages: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

export const ChatSessionModel: Model<ChatSessionDoc> =
  mongoose.models.ChatSession ?? mongoose.model<ChatSessionDoc>("ChatSession", ChatSessionSchema);
