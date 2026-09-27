import re

from fastapi import FastAPI, Header, HTTPException
from groq import APIStatusError as GroqAPIStatusError
from pydantic import BaseModel, Field

from .agent import build_agent, build_intake_agent, extract_finalize_intake, extract_navigate, sanitize_reply, summarize_tool_calls
from .config import settings
from .next_client import NextClient
from .planning.generator import PlanGenerationError, generate_plan
from .safety import redact
from .schemas import AgentChatRequest, AgentChatResponse, ChatTurn
from .security import verify_token

app = FastAPI(title="toure-agent-service")


def _extract_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return authorization.removeprefix("Bearer ")


def friendly_llm_error(exc: Exception) -> str:
    """Groq being rate-limited or briefly down is common on a free/demo key and is not a bug in this service -
    say so plainly instead of a generic 500 the caller has no way to act on (which is what Next's own fallback,
    'I couldn't reach the assistant service', was actually masking)."""
    if isinstance(exc, GroqAPIStatusError) and exc.status_code == 429:
        m = re.search(r"try again in ([\d.]+)s", str(exc))
        if m:
            minutes = max(1, round(float(m.group(1)) / 60))
            return f"The AI model has hit its daily free-tier limit. Try again in about {minutes} minute{'s' if minutes != 1 else ''}."
        return "The AI model has hit its daily free-tier limit. Try again in a few minutes."
    if isinstance(exc, GroqAPIStatusError):
        return f"The AI service returned an error ({exc.status_code}). Please try again in a moment."
    return "Something went wrong reaching the AI model. Please try again in a moment."


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

    agent = build_agent(token=token, trip_id=body.tripId)
    messages = [{"role": turn.role, "content": turn.content} for turn in body.history]
    messages.append({"role": "user", "content": redact(body.message)[0]})

    try:
        result = await agent.ainvoke({"messages": messages})
    except Exception as exc:
        return AgentChatResponse(reply=friendly_llm_error(exc), navigate=None, toolCalls=[])
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
    # Who is travelling: [{name, age, stepFree?, interests?}]. Optional; sensible defaults come from groupType.
    members: list[dict] = Field(default_factory=list)


class PlanCreatedResponse(BaseModel):
    tripId: str
    planId: str
    title: str


async def _run_and_persist(client: NextClient, destination: str, start_date: str, end_date: str, budget: float, currency: str, group_type: str, theme_tags: list[str], members: list[dict] | None = None) -> dict:
    generated = await generate_plan(client, destination, start_date, end_date, budget, theme_tags, group_type, members)
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
        created = await _run_and_persist(client, body.destination, body.startDate, body.endDate, body.budget, body.currency, body.groupType, body.themeTags, body.members)
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
    messages.append({"role": "user", "content": redact(body.message)[0]})
    try:
        result = await agent.ainvoke({"messages": messages})
    except Exception as exc:
        return PlanIntakeResponse(reply=friendly_llm_error(exc), complete=False)

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


# ---------------------------------------------------------------- disruption engine + digital twin
from typing import Literal, Optional  # noqa: E402

from . import digital_twin as DT  # noqa: E402
from .planning.disruption import run_trigger  # noqa: E402


class TriggerRequest(BaseModel):
    tripId: Optional[str] = None
    type: Literal["weather", "running_late", "unavailable", "budget_change"]
    day: Optional[int] = None
    minutes: Optional[int] = None
    fromTime: Optional[str] = None
    itemId: Optional[str] = None
    budget: Optional[float] = None


@app.post("/disruptions/trigger")
async def disruption_trigger(body: TriggerRequest, authorization: str | None = Header(default=None)) -> dict:
    """Something changed: analyse the impact and store 2-3 recovery options for the trip admin."""
    token = _extract_token(authorization)
    verify_token(token)
    return await run_trigger(NextClient(settings.next_internal_base_url, token), body.model_dump(exclude_none=True), source="app")


@app.get("/digital-twin/live-weather")
async def twin_live_weather(city: str = "Jaipur", authorization: str | None = Header(default=None)) -> dict:
    verify_token(_extract_token(authorization))
    return await DT.fetch_live_weather(city)


@app.get("/digital-twin/overview")
async def twin_overview(authorization: str | None = Header(default=None)) -> dict:
    """Every destination's current weather and a risk score from the same simulator, for the map."""
    verify_token(_extract_token(authorization))
    out = []
    for city in DT.CITY_COORDS:
        w = await DT.fetch_live_weather(city)
        sim = DT.simulate_digital_twin_impact(city, w["precipitation_mm"], w["temperature"], 0, "None", w["wind_speed"])["probabilistic_predictions"]
        risk = max(sim["outdoor_activity_risk_pct"], sim["transport_delay_probability_pct"])
        out.append({**w, "risk": round(risk, 1), "level": "high" if risk > 60 else "moderate" if risk > 30 else "low"})
    return {"cities": out, "live": any(c["is_live"] for c in out)}


class SimulateRequest(BaseModel):
    city: str = "Jaipur"
    rain_mm: float = Field(default=0, ge=0, le=500)
    temp: float = Field(default=30, ge=-20, le=60)
    storm_duration_hrs: float = Field(default=0, ge=0, le=72)
    flood_level: Literal["None", "Low", "Moderate", "Severe"] = "None"
    wind_speed: float = Field(default=10, ge=0, le=250)


@app.post("/digital-twin/simulate")
async def twin_simulate(body: SimulateRequest, authorization: str | None = Header(default=None)) -> dict:
    verify_token(_extract_token(authorization))
    return DT.simulate_digital_twin_impact(**body.model_dump())


class MitigationRequest(BaseModel):
    tripId: str
    day: Optional[int] = None


@app.post("/digital-twin/apply-mitigation")
async def twin_apply(body: MitigationRequest, authorization: str | None = Header(default=None)) -> dict:
    """Hand the simulated weather over to the disruption engine for a real trip: it prepares indoor swaps for the admin."""
    token = _extract_token(authorization)
    verify_token(token)
    return await run_trigger(NextClient(settings.next_internal_base_url, token), {"type": "weather", "tripId": body.tripId, "day": body.day}, source="digital_twin")


# ---------------------------------------------------------------- booking & ticketing agent (Gemini, Mahavir's design)
from . import booking_agent  # noqa: E402


class BookingChatRequest(BaseModel):
    message: str
    history: list[ChatTurn] = Field(default_factory=list)
    tripId: Optional[str] = None


@app.post("/booking/chat")
async def booking_chat(body: BookingChatRequest, authorization: str | None = Header(default=None)) -> dict:
    token = _extract_token(authorization)
    verify_token(token)
    client = NextClient(settings.next_internal_base_url, token, trip_id=body.tripId)
    history = [{"role": t.role, "content": t.content} for t in body.history]
    return await booking_agent.chat(client, history, body.message)


@app.get("/booking/status")
async def booking_status() -> dict:
    return {"engine": "gemini" if booking_agent.gemini_key() else "rules (no GEMINI_API_KEY set)", "model": booking_agent.gemini_model()}
