import mongoose, { Schema, type Model } from "mongoose";

/** Every tool call the assistant makes, allowed or blocked, with secrets redacted, for the trip admin to review. */
export interface AgentAuditDoc {
  tripId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  actor: "agent" | "traveller" | "system";
  action: string;
  detail: Record<string, unknown>;
  outcome: "ok" | "blocked" | "error";
  intentId?: string;
  createdAt: Date;
}

const AuditSchema = new Schema<AgentAuditDoc>(
  {
    tripId: { type: Schema.Types.ObjectId, ref: "Trip", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actor: { type: String, required: true },
    action: { type: String, required: true },
    detail: { type: Schema.Types.Mixed, default: {} },
    outcome: { type: String, default: "ok" },
    intentId: { type: String },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const AgentAuditModel: Model<AgentAuditDoc> = mongoose.models.AgentAudit ?? mongoose.model<AgentAuditDoc>("AgentAudit", AuditSchema);
