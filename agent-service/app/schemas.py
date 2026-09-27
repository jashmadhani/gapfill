"""The Next.js <-> Python wire contract.

TypeScript types are erased at compile time, so they can't be imported here
in any form. The actual contract is the JSON that crosses the process
boundary, and it's pinned down on the TS side as zod schemas in
toure/lib/schemas/chat.ts (which also validates every payload at runtime on
that end). `npm run export-agent-schemas` dumps those same shapes as JSON
Schema into agent-service/schemas/*.json, and
agent-service/tests/test_schema_contract.py asserts this file's field names
match that checked-in JSON Schema, so a change to one side that forgets the
other fails a test instead of failing silently in production.

Field names here are deliberately camelCase (not idiomatic Python) so the
JSON on the wire is byte-identical on both sides - no alias mapping to get
wrong between `tool_calls` and `toolCalls`.
"""

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    role: Literal["user", "assistant", "system", "tool"]
    content: str


class AgentChatRequest(BaseModel):
    message: str
    history: list[ChatTurn] = Field(default_factory=list)
    tripId: Optional[str] = None


class NavigateAction(BaseModel):
    target: Literal["discover", "trip", "plan", "ask", "profile"]
    reason: Optional[str] = None


class ToolCallLog(BaseModel):
    name: str
    args: dict[str, Any] = Field(default_factory=dict)


class AgentChatResponse(BaseModel):
    reply: str
    navigate: Optional[NavigateAction] = None
    toolCalls: list[ToolCallLog] = Field(default_factory=list)
