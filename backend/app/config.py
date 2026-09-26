"""Server-side configuration and secrets.

Secrets (GEMINI_API_KEY, RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET, TICKET_SECRET) are read from real environment
variables or from backend/.env (git-ignored). They are only ever used by server code: they are never sent to the
browser, never placed in an AI prompt, and never written to logs or the audit trail.
"""
import os
import secrets

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_loaded = False


def load_env():
    """Read backend/.env once (KEY=VALUE per line). Real environment variables always win."""
    global _loaded
    if _loaded:
        return
    _loaded = True
    path = os.path.join(BACKEND, ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def gemini_key() -> str | None:
    load_env()
    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")


def gemini_model() -> str:
    load_env()
    return os.environ.get("GEMINI_MODEL", "gemini-flash-latest")


def razorpay_keys() -> tuple[str, str] | None:
    load_env()
    kid, sec = os.environ.get("RAZORPAY_KEY_ID"), os.environ.get("RAZORPAY_KEY_SECRET")
    return (kid, sec) if kid and sec else None


def ticket_secret() -> bytes:
    """Signs ticket QR codes. From TICKET_SECRET, else a random secret generated once and kept in backend/.ticket_secret."""
    load_env()
    if os.environ.get("TICKET_SECRET"):
        return os.environ["TICKET_SECRET"].encode()
    path = os.path.join(BACKEND, ".ticket_secret")
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(secrets.token_hex(32))
    with open(path, encoding="utf-8") as fh:
        return fh.read().strip().encode()


def agent_max_proposal() -> float:
    """Hard ceiling on any single payment the agent may even propose (the traveler still has to approve it)."""
    load_env()
    return float(os.environ.get("AGENT_MAX_PROPOSAL", "500000"))
