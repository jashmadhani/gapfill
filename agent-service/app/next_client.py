import httpx


class NextClient:
    """Thin wrapper for calling back into Next.js's /api/agent/* routes as
    the authenticated user, using the same short-lived token this request
    arrived with. Data access logic (Mongo queries, redaction of sensitive
    fields) stays in one place - the TS codebase - rather than being
    duplicated here."""

    def __init__(self, base_url: str, token: str):
        self._base_url = base_url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {token}"}

    async def get(self, path: str, params: dict | None = None) -> dict:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{self._base_url}{path}", params=params, headers=self._headers)
            resp.raise_for_status()
            return resp.json()

    async def post(self, path: str, json: dict) -> dict:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(f"{self._base_url}{path}", json=json, headers=self._headers)
            resp.raise_for_status()
            return resp.json()
