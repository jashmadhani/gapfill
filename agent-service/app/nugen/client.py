"""Nugen API client. Reads NUGEN_API_KEY from the environment or backend/.env; the aligned model id comes from
NUGEN_MODEL_ID or nugen_model.json (written by `python -m app.nugen.align`)."""
import json
import os

import httpx

BASE_URL = os.environ.get("NUGEN_BASE_URL", "https://api.nugen.in").rstrip("/")
HERE = os.path.dirname(__file__)
MODEL_FILE = os.path.join(HERE, "nugen_model.json")
ENV_FILE = os.path.join(HERE, "..", "..", ".env")


def _load_env() -> None:
    try:
        for line in open(ENV_FILE):
            k, sep, v = line.strip().partition("=")
            if sep and k and not k.startswith("#"):
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except OSError:
        pass


_load_env()


def api_key() -> str | None:
    return os.environ.get("NUGEN_API_KEY") or None


def headers() -> dict:
    return {"Authorization": f"Bearer {api_key()}"}


def model_info() -> dict:
    try:
        return json.load(open(MODEL_FILE))
    except (OSError, ValueError):
        return {}


def model_id() -> str | None:
    return os.environ.get("NUGEN_MODEL_ID") or model_info().get("model_id")


def enabled() -> bool:
    return bool(api_key() and model_id())


def sync() -> httpx.Client:
    return httpx.Client(base_url=BASE_URL, headers=headers(), timeout=60)


def chat_sync(messages: list, max_tokens: int = 60) -> str:
    with sync() as c:
        r = c.post("/api/v3/inference/chat/completions", json={"model": model_id(), "messages": messages, "max_tokens": max_tokens,
                                                                "temperature": 0.0, "stream": False})
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
