import httpx


class NextClient:
    """Thin wrapper for calling back into Next.js's /api/agent/* routes as
    the authenticated user, using the same short-lived token this request
    arrived with. Data access logic (Mongo queries, redaction of sensitive
    fields) stays in one place - the TS codebase - rather than being
    duplicated here."""

    def __init__(self, base_url: str, token: str, trip_id: str | None = None):
        self._base_url = base_url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {token}"}
        # Which trip this whole chat is bound to (from the chat session the traveller opened), so every
        # "current trip" lookup the agent makes resolves to the trip on screen, not whichever trip happens to be
        # active/upcoming/most-recently-touched account-wide. Call sites keep saying {"trip": "current"} /
        # {"tripId": None} as before; this substitutes the bound id transparently when one is set.
        self.trip_id = trip_id

    def _resolve(self, params: dict | None) -> dict:
        params = dict(params or {})
        if self.trip_id:
            if params.get("trip") in (None, "current"):
                params["trip"] = self.trip_id
            if not params.get("tripId"):
                params["tripId"] = self.trip_id
        return params

    async def get(self, path: str, params: dict | None = None) -> dict:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{self._base_url}{path}", params=self._resolve(params), headers=self._headers)
            resp.raise_for_status()
            return resp.json()

    async def post(self, path: str, json: dict) -> dict:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(f"{self._base_url}{path}", json=self._resolve(json), headers=self._headers)
            resp.raise_for_status()
            return resp.json()
