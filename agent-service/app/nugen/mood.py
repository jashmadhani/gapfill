"""Mood parsing with the Nugen-aligned model. Returns None when Nugen is not configured or fails, so callers fall back
to the local scikit-learn mood model."""
import json
import re

import httpx

from ..ml.priors import MOODS
from . import client

LABELS = ", ".join(MOODS)
TEMPLATE = "Traveler message: {text}\nMood labels (" + LABELS + ") as JSON:"
SYSTEM = ("You read a traveler's message during a trip and reply with JSON only: "
          '{"moods": [...]} using labels from ' + json.dumps(MOODS) + '. Use {"moods": []} when the message expresses no mood.')


def parse_reply(text: str) -> list | None:
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        return None
    try:
        moods = json.loads(m.group(0)).get("moods")
    except ValueError:
        return None
    return [x for x in moods if x in MOODS] if isinstance(moods, list) else None


async def parse_mood(text: str) -> list | None:
    if not client.enabled() or not text.strip():
        return None
    try:
        async with httpx.AsyncClient(base_url=client.BASE_URL, headers=client.headers(), timeout=15) as c:
            r = await c.post("/api/v3/inference/chat/completions", json={
                "model": client.model_id(), "max_tokens": 60, "temperature": 0.0, "stream": False,
                "messages": [{"role": "user", "content": TEMPLATE.format(text=text)}]})
            r.raise_for_status()
            return parse_reply(r.json()["choices"][0]["message"]["content"])
    except Exception:
        return None
