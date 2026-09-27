"""Guards the Next.js <-> Python wire contract described in
toure/lib/schemas/chat.ts: if either side's field names drift from the
checked-in JSON Schema snapshot, this fails instead of failing silently at
runtime. Regenerate the snapshot with `npm run export-agent-schemas` after
changing lib/schemas/chat.ts, then update app/schemas.py to match."""

import json
from pathlib import Path

from app.schemas import AgentChatRequest, AgentChatResponse, ChatTurn, NavigateAction, ToolCallLog

SCHEMA_DIR = Path(__file__).parent.parent / "schemas"


def _top_level_keys(filename: str) -> set[str]:
    data = json.loads((SCHEMA_DIR / filename).read_text())
    return set(data.get("properties", {}).keys())


def test_chat_request_fields_match_ts_contract():
    assert _top_level_keys("agent-chat-request.schema.json") == set(AgentChatRequest.model_fields.keys())
    assert set(ChatTurn.model_fields.keys()) == {"role", "content"}


def test_chat_response_fields_match_ts_contract():
    assert _top_level_keys("agent-chat-response.schema.json") == set(AgentChatResponse.model_fields.keys())
    assert set(NavigateAction.model_fields.keys()) == {"target", "reason"}
    assert set(ToolCallLog.model_fields.keys()) == {"name", "args"}
