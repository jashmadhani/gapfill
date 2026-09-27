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
    """This small aligned model answers the same question in several different (but each individually valid) shapes:
    {"moods": [...]} as trained, a per-label {"tired": false, "hot": true, ...} dict, a bare JSON array
    ["hot", "foodie"], or plain comma/space-separated label words with no JSON at all. All are accepted; anything
    that yields zero known labels falls through to the next shape rather than being treated as "no mood"."""
    text = (text or "").strip()
    if not text:
        return None
    obj = re.search(r"\{.*\}", text, re.S)
    if obj:
        try:
            data = json.loads(obj.group(0))
        except ValueError:
            data = None
        if isinstance(data, dict):
            if isinstance(data.get("moods"), list):
                found = [x for x in data["moods"] if x in MOODS]
                if found:
                    return found
            if data and all(isinstance(v, bool) for v in data.values()):
                found = [k for k, v in data.items() if v and k in MOODS]
                if found:
                    return found
    arr = re.search(r"\[.*\]", text, re.S)
    if arr:
        try:
            data = json.loads(arr.group(0))
        except ValueError:
            data = None
        if isinstance(data, list):
            found = [x for x in data if x in MOODS]
            if found:
                return found
    # Plain text: whichever known labels appear as whole words, in order of appearance.
    found = [m for m in MOODS if re.search(r"\b" + re.escape(m) + r"\b", text)]
    return found or None


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
