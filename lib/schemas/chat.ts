import { z } from "zod";

/**
 * TypeScript interfaces are erased at compile time - Python can't import
 * `types/chat.ts` in any form, at runtime or otherwise. What actually
 * crosses the Next.js <-> Python boundary is JSON, so *that* is the real
 * contract, and this file is where it's pinned down as executable code
 * rather than just prose:
 *
 *  - These zod schemas validate every payload at the boundary in this app
 *    (see app/api/chat/sessions/[id]/messages/route.ts), so a shape drift
 *    fails loudly here instead of silently corrupting stored chat history.
 *  - `npm run export-agent-schemas` (scripts/export-agent-schemas.mjs) dumps
 *    the same shapes as JSON Schema (via zod v4's built-in `z.toJSONSchema`)
 *    into agent-service/schemas/*.json.
 *  - agent-service/app/schemas.py defines the matching Pydantic models by
 *    hand (camelCase field names, deliberately un-Pythonic, so the wire JSON
 *    keys are identical on both sides with no alias mapping to get wrong).
 *  - agent-service/tests/test_schema_contract.py asserts the Pydantic models'
 *    field names equal the checked-in JSON Schema's, so an update to one
 *    side that forgets the other fails CI instead of failing silently in
 *    production.
 *
 * Only the slice that actually leaves the Node process is modeled this way -
 * everything else (Trip, PlanDocument, ChatSession, ...) stays a plain TS
 * interface checked only within this app, same as before this feature.
 */

export const chatTurnSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string(),
});

export const navigateActionSchema = z.object({
  target: z.enum(["discover", "trip", "plan", "ask", "profile"]),
  reason: z.string().optional(),
});

export const toolCallLogSchema = z.object({
  name: z.string(),
  args: z.record(z.string(), z.unknown()),
});

export const agentChatRequestSchema = z.object({
  message: z.string(),
  history: z.array(chatTurnSchema).default([]),
  tripId: z.string().optional(),
});

export const agentChatResponseSchema = z.object({
  reply: z.string(),
  navigate: navigateActionSchema.nullable().optional(),
  toolCalls: z.array(toolCallLogSchema).default([]),
});

export type AgentChatRequest = z.infer<typeof agentChatRequestSchema>;
export type AgentChatResponse = z.infer<typeof agentChatResponseSchema>;
