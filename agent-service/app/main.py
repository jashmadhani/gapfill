from fastapi import FastAPI, Header, HTTPException

from .agent import build_agent, extract_navigate, sanitize_reply, summarize_tool_calls
from .schemas import AgentChatRequest, AgentChatResponse
from .security import verify_token

app = FastAPI(title="toure-agent-service")


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


@app.post("/chat", response_model=AgentChatResponse)
async def chat(body: AgentChatRequest, authorization: str | None = Header(default=None)) -> AgentChatResponse:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ")

    # Verifying here (not just trusting Next.js) means a leaked or forged
    # token still can't make this service run tool calls on someone's behalf
    # - it has to be a token this exact secret actually signed, unexpired.
    verify_token(token)

    agent = build_agent(token=token)
    messages = [{"role": turn.role, "content": turn.content} for turn in body.history]
    messages.append({"role": "user", "content": body.message})

    result = await agent.ainvoke({"messages": messages})
    reply = sanitize_reply(result["messages"][-1].content)

    return AgentChatResponse(
        reply=reply,
        navigate=extract_navigate(result["messages"]),
        toolCalls=summarize_tool_calls(result["messages"]),
    )
