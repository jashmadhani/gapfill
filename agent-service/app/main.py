from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .agent import build_agent, build_intake_agent, extract_finalize_intake, extract_navigate, sanitize_reply, summarize_tool_calls
from .config import settings
from .next_client import NextClient
from .planning.generator import PlanGenerationError, generate_plan
from .schemas import AgentChatRequest, AgentChatResponse, ChatTurn
from .security import verify_token

app = FastAPI(title="toure-agent-service")


def _extract_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return authorization.removeprefix("Bearer ")


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


@app.post("/chat", response_model=AgentChatResponse)
async def chat(body: AgentChatRequest, authorization: str | None = Header(default=None)) -> AgentChatResponse:
    token = _extract_token(authorization)
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


class PlanGenerateRequest(BaseModel):
    destination: str
    startDate: str
    endDate: str
    budget: float = 0
    currency: str = "INR"
    groupType: str = "solo"
    themeTags: list[str] = Field(default_factory=list)


class PlanCreatedResponse(BaseModel):
    tripId: str
    planId: str
    title: str


async def _run_and_persist(client: NextClient, destination: str, start_date: str, end_date: str, budget: float, currency: str, group_type: str, theme_tags: list[str]) -> dict:
    generated = await generate_plan(client, destination, start_date, end_date, budget, theme_tags)
    return await client.post(
        "/api/agent/plan/create",
        {
            "destination": destination,
            "startDate": start_date,
            "endDate": end_date,
            "budget": budget,
            "currency": currency,
            "groupType": group_type,
            "themeTags": theme_tags,
            **generated,
        },
    )


@app.post("/plan/generate", response_model=PlanCreatedResponse)
async def plan_generate(body: PlanGenerateRequest, authorization: str | None = Header(default=None)) -> PlanCreatedResponse:
    """The form-submission path on the Plan tab: structured params straight
    in, no conversation needed."""
    token = _extract_token(authorization)
    verify_token(token)
    client = NextClient(settings.next_internal_base_url, token)
    try:
        created = await _run_and_persist(client, body.destination, body.startDate, body.endDate, body.budget, body.currency, body.groupType, body.themeTags)
    except PlanGenerationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return PlanCreatedResponse(**created)


class PlanIntakeRequest(BaseModel):
    message: str
    history: list[ChatTurn] = Field(default_factory=list)


class PlanIntakeResponse(BaseModel):
    reply: str
    complete: bool
    tripId: str | None = None


@app.post("/plan/intake", response_model=PlanIntakeResponse)
async def plan_intake(body: PlanIntakeRequest, authorization: str | None = Header(default=None)) -> PlanIntakeResponse:
    """The "plan with AI" chat-bar path: a short conversation to gather trip
    params, then the same generation pipeline as /plan/generate once
    finalize_trip_intake fires."""
    token = _extract_token(authorization)
    verify_token(token)

    agent = build_intake_agent()
    messages = [{"role": turn.role, "content": turn.content} for turn in body.history]
    messages.append({"role": "user", "content": body.message})
    result = await agent.ainvoke({"messages": messages})

    finalize = extract_finalize_intake(result["messages"])
    reply = sanitize_reply(result["messages"][-1].content)
    if not finalize:
        return PlanIntakeResponse(reply=reply, complete=False)

    client = NextClient(settings.next_internal_base_url, token)
    try:
        created = await _run_and_persist(
            client,
            finalize["destination"],
            finalize["start_date"],
            finalize["end_date"],
            finalize.get("budget", 0),
            "INR",
            finalize.get("group_type", "solo"),
            finalize.get("theme_tags", []),
        )
    except PlanGenerationError as exc:
        return PlanIntakeResponse(reply=f"I have your details, but {exc} Want to try a different destination or dates?", complete=False)

    return PlanIntakeResponse(reply=f"Done! I've put together {created['title']} for you. Opening it now.", complete=True, tripId=created["tripId"])
