import jwt
from fastapi import HTTPException

from .config import settings

AUDIENCE = "agent-service"


def verify_token(token: str) -> str:
    """Verifies the short-lived JWT Next.js mints per chat turn (see
    toure/lib/auth/agent-jwt.ts). Returns the user id (the token's `sub`)."""
    try:
        payload = jwt.decode(token, settings.agent_service_secret, algorithms=["HS256"], audience=AUDIENCE)
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {exc}") from exc

    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        raise HTTPException(status_code=401, detail="Token missing subject")
    return sub
