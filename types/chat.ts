import { Id, ISODateTime } from "./common";

export type ChatRole = "user" | "assistant" | "system" | "tool";

/** A record of one tool the agent invoked while producing a reply, kept for
 * transparency in the UI/debugging - not shown to the user as raw JSON, but
 * available if we ever want an "how did it know that" affordance. */
export interface ChatToolCall {
  name: string;
  args: Record<string, unknown>;
}

export type NavigateTarget = "discover" | "trip" | "plan" | "ask" | "profile";

/** The agent's way of actually moving the user around the app, not just
 * describing where to go - the frontend performs the navigation when a
 * reply carries this. */
export interface NavigateAction {
  target: NavigateTarget;
  reason?: string;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  toolCalls?: ChatToolCall[];
  navigate?: NavigateAction;
  createdAt: ISODateTime;
}

/** "normal" = the Ask tab's general assistant. "plan" = the AI-intake
 * conversation on the Plan tab that produces a trip (see PlanDocument) - it
 * shows up in the same chat-history menu, but the UI marks it read-only once
 * `planTripId` is set, since the conversation's job (producing that plan) is
 * finished at that point. */
export type ChatSessionTag = "normal" | "plan";

/** One conversation thread, listed in the Ask tab's chat-history menu. A
 * user can hold many; each is a fully independent context window sent to
 * the agent (see lib/schemas/chat.ts for the wire contract with the Python
 * agent service). */
export interface ChatSession {
  _id: Id;
  sessionId: string;
  userId: Id;
  title: string;
  tag: ChatSessionTag;
  /** Set once a "plan"-tagged session successfully produces a trip - the
   * conversation becomes read-only from that point on. Absent for "normal"
   * sessions and for "plan" sessions still mid-intake. */
  planTripId?: Id;
  messages: ChatMessage[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * A durable fact the agent chose to remember about the user's taste or
 * constraints (generalizes trip-planner's tag_affinities drift into
 * free-text, agent-authored notes) - injected into every new session's
 * context so the assistant doesn't start from zero each time. Written only
 * via the agent's own `remember_fact` tool, never edited directly by the UI.
 */
export interface ChatMemoryFact {
  _id: Id;
  userId: Id;
  fact: string;
  sourceSessionId?: string;
  createdAt: ISODateTime;
}
