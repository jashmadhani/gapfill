# toure agent-service

The Ask tab's assistant. A separate Python process (FastAPI + LangGraph +
Groq) because Next.js can't run Python in-process - it's called over HTTP by
`toure/app/api/chat/sessions/[id]/messages/route.ts`.

## Why a separate service, and how auth works

Next.js mints a short-lived (60s) JWT per chat turn (`lib/auth/agent-jwt.ts`),
signed with `AGENT_SERVICE_SECRET`. This service verifies that token to
authenticate the incoming `/chat` call, then reuses the *same* token to call
back into Next.js's `/api/agent/*` routes as that user - so Mongo access and
sensitive-field redaction (no email, phone, or auth data ever reaches the
agent) stay defined once, in TypeScript, not duplicated here.

## Setup

```bash
cd agent-service
python -m venv .venv
.venv/Scripts/activate        # or `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # fill in AGENT_SERVICE_SECRET (copy from toure/.env.local) and GROQ_API_KEY
uvicorn app.main:app --reload --port 8010
```

Port 8010, not 8000 - if you also run gapfill's own backend on this machine,
that's already on 8000. Next.js reads the URL from `AGENT_SERVICE_URL` in
`toure/.env.local` (set to `http://localhost:8010`), alongside the same
`AGENT_SERVICE_SECRET`.

## Deploying

In production this runs as part of the *same* Vercel project as the Next.js
app, via the `services` block in `../vercel.json` (a [Vercel
Service](https://vercel.com/docs/services), FastAPI framework - no code
changes needed for that). It has no public rewrite of its own there, so it's
reachable only from `web` (the Next.js service) through a [service
binding](https://vercel.com/docs/services/bindings), never directly from the
internet - `AGENT_SERVICE_URL`/`NEXT_INTERNAL_BASE_URL` are auto-injected by
that binding in production and only need manual values (as above) for local
dev. See `../README.md`'s "Deploy on Vercel" section for the env vars to set.

## Tools

Each tool is small and independently selectable by the model - see
`app/tools/`: `get_my_profile`, `list_my_trips`, `get_trip_details`,
`summarize_past_trips`, `search_experiences`, `navigate_app`, `remember_fact`.

## Tests

```bash
pytest
```

Covers the schema-contract check (`tests/test_schema_contract.py`) against
`schemas/*.json`, regenerated from the TS side with `npm run
export-agent-schemas` (see `toure/lib/schemas/chat.ts`), and the reply
sanitizer (`tests/test_sanitize_reply.py`) that guarantees clean ASCII output
regardless of the model's occasional Unicode mis-tokenization (see
`app/agent.py`'s `sanitize_reply`).
