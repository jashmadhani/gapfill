import json
import re

from langchain_groq import ChatGroq
from langgraph.prebuilt import create_react_agent

from .config import settings
from .next_client import NextClient
from .tools import discover_tools, history_tools, memory_tools, navigation_tools, profile_tools, trip_tools

SYSTEM_PROMPT = """You are Toure's in-app trip assistant. You can see the user's own \
trips, preferences, and travel history through tools - always call a tool to fetch \
real data rather than guessing or inventing numbers, names, or dates. You can also \
move the user to a different tab of the app with navigate_app when that's the \
clearest way to help (e.g. "open my day-by-day plan" -> plan). If you learn a \
durable preference or constraint worth remembering, use remember_fact.

Keep replies short, warm, and specific - a couple of sentences, not an essay. \
Never mention or ask for email addresses, phone numbers, or account/auth details; \
you don't have access to them and never will.

Write in plain ASCII only: a hyphen "-" instead of an en/em dash, a straight \
apostrophe/quotes instead of curly ones, a regular space instead of a \
non-breaking space, and "Rs." instead of the rupee sign. (This model
garbles those specific characters when it generates them directly.)"""


def build_agent(token: str):
    """Builds a fresh LangGraph ReAct agent per request, with tools closed
    over this one request's short-lived token - no shared state between
    users, no global agent instance to worry about concurrency for."""
    client = NextClient(settings.next_internal_base_url, token)
    tools = [
        *profile_tools.make_tools(client),
        *trip_tools.make_tools(client),
        *history_tools.make_tools(client),
        *discover_tools.make_tools(client),
        *navigation_tools.make_tools(),
        *memory_tools.make_tools(client),
    ]
    model = ChatGroq(model=settings.groq_model, api_key=settings.groq_api_key, temperature=0.4)
    return create_react_agent(model, tools, prompt=SYSTEM_PROMPT)


def extract_navigate(messages: list) -> dict | None:
    """Scans the run's tool messages for the last navigate_app call and
    returns its structured result, or None if the agent didn't navigate."""
    for message in reversed(messages):
        if getattr(message, "name", None) != "navigate_app":
            continue
        content = message.content
        try:
            data = json.loads(content) if isinstance(content, str) else content
        except (TypeError, ValueError):
            continue
        if isinstance(data, dict) and data.get("target"):
            return data
    return None


_UNICODE_REPLACEMENTS = {
    "‘": "'", "’": "'", "“": '"', "”": '"',
    "–": "-", "—": "-", "‑": "-", "−": "-",
    "€": "Rs.", "₹": "Rs.", "→": "->", " ": " ",
}


def sanitize_reply(text: str) -> str:
    """openai/gpt-oss-120b on Groq intermittently mis-tokenizes rare Unicode
    glyphs (rupee sign, em-dashes, arrows, curly quotes) into garbled
    multi-byte mojibake - confirmed by calling Groq's API directly with the
    LangChain layer removed, so it's an upstream model quirk, not a bug in
    this pipeline. The system prompt asks the model to avoid these glyphs,
    but since that's a request, not a guarantee, this is the actual
    guarantee: known substitutions applied, then anything still non-ASCII
    (i.e. whatever the model mangled) is dropped rather than shipped broken."""
    for bad, good in _UNICODE_REPLACEMENTS.items():
        text = text.replace(bad, good)
    text = text.encode("ascii", errors="ignore").decode("ascii")
    # The garbled glyph this is standing in for is sometimes preceded by a
    # space that got eaten in the same mangled token (e.g. "total<NBSP><Rs
    # sign>60,000" -> "totalRs.60,000") - put it back so words don't run
    # together.
    text = re.sub(r"(?<=[a-zA-Z0-9])Rs\.", " Rs.", text)
    return re.sub(r" {2,}", " ", text).strip()


def summarize_tool_calls(messages: list) -> list[dict]:
    calls = []
    for message in messages:
        for call in getattr(message, "tool_calls", None) or []:
            calls.append({"name": call["name"], "args": call.get("args", {})})
    return calls
