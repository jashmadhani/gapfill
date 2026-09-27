import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


@dataclass
class Settings:
    # Must be byte-identical to toure/.env.local's AGENT_SERVICE_SECRET - this
    # is the shared key that lets Next.js and this service trust each other's
    # short-lived tokens without a shared session store.
    agent_service_secret: str = field(default_factory=lambda: _require("AGENT_SERVICE_SECRET"))
    next_internal_base_url: str = field(default_factory=lambda: os.environ.get("NEXT_INTERNAL_BASE_URL", "http://localhost:3000"))
    groq_api_key: str = field(default_factory=lambda: os.environ.get("GROQ_API_KEY", ""))
    groq_model: str = field(default_factory=lambda: os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b"))


def _require(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing {name} environment variable - copy agent-service/.env.example to .env and fill it in.")
    return value


settings = Settings()
