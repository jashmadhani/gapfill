# GapFill

GapFill is a local experience platform built for HackCelestial 3.0, PS-6: Local & Experiences. It reads a traveler's day, finds the idle gaps and fills each one with **one** best-fit local experience plus two quiet backups. When a plan breaks, it re-solves the same window and pushes a one-tap replacement card. Local hosts list their experiences through a WhatsApp-style chat and set availability with one tap.

Everything runs offline and gives the same results on every run. There are no maps, weather, payment or LLM calls unless you add an API key yourself.

## Quick start (one command)

Requirements: Python 3.11+ and Node 18+.

```bash
./dev.sh
```

On first run, the script creates the Python venv, installs the npm packages, seeds the database and starts both servers. Then open:

| Surface | URL |
|---|---|
| Traveler app (mobile-first) | http://localhost:5173 |
| **Live Ops demo view** (traveler + vendor side by side, plus trigger buttons) | http://localhost:5173/ops |
| Vendor status console | http://localhost:5173/vendor/1 |
| Vendor chat onboarding | http://localhost:5173/vendor/chat |
| API docs (Swagger) | http://localhost:8000/docs |

## Manual setup

```bash
# backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m app.seed          # (re)create tables + load seed data
.venv/bin/uvicorn app.main:app --reload --port 8000

# frontend (second terminal)
cd frontend
npm install
npm run dev                           # http://localhost:5173 (proxies /api and /ws to :8000)
```

The backend seeds itself automatically on first start if the database is empty.

### Database

The default is SQLite at `backend/gapfill.db`, so no setup is needed. To use PostgreSQL instead:

```bash
createdb gapfill
DATABASE_URL=postgresql+asyncpg://localhost/gapfill .venv/bin/python -m app.seed
DATABASE_URL=postgresql+asyncpg://localhost/gapfill .venv/bin/uvicorn app.main:app --port 8000
```

### Optional LLM

Set `ANTHROPIC_API_KEY` and `GAPFILL_LLM_MODEL` (an Anthropic model id) before starting the backend. The backend then uses that model for two things: parsing traveler moods and extracting listings from the vendor chat. Without a key, or if a call fails, the backend falls back to rules-based parsers, so the flow never breaks. Live Ops shows which mode is active in its header (`intent: rules-fallback` or `anthropic`).

### Reset demo data

Use any one of these:

- the **Reset demo data** button in Live Ops
- `POST /demo/reset`
- `backend/.venv/bin/python -m app.seed`

### Test

```bash
cd backend && .venv/bin/python -m tests.smoke_test
```

This test covers the whole loop: recommendations, bundles, all 4 disruption triggers (each one is pushed over the WebSocket and then accepted), booking, intent parsing, vendor onboarding, vendor status changes and demand signals.

## 90-second demo script

1. Open **http://localhost:5173/ops** and click **Reset demo data**. The demo clock is 11:30 AM. The traveler has finished Amber Fort, and City Palace is booked at 3:30 PM.
2. The traveler phone shows **one** card for the 12:00–3:30 PM gap. It gives the fit reasoning ("back at City Palace by 1:35 PM with 1h 55m to spare"), the price, the trust score and the accessibility icons. **See 2 alternatives** and **Make it a combo** are small secondary links.
3. The evening already holds the *Old City Street Food Trail* (outdoor, ₹800). In Ops, press **Make it rain**. A replan card slides up on the traveler phone within about 1 second. It shows the reason in plain language, 1 indoor replacement and 1 backup.
4. Tap **Accept swap**. The timeline updates, a booking reference is issued, and the Ops event log records the accept.
5. Press **Reset demo data** again and try the other triggers:
   - **Mark experience unavailable** (the ★ item)
   - the vendor **Close** button
   - **Simulate running late** (45 min)
   - **Change budget** to ₹500

   A vendor tapping **Fully booked** in their console also replans the traveler automatically.
6. Open **/vendor/chat** and tap **⚡ Demo: fill sample answers**. Check the extracted draft, then tap **Publish**. The new listing becomes eligible right away.

## Project layout

```
backend/
  app/
    main.py        FastAPI routes + WebSocket hub
    engine.py      algorithms: trust score, gap detection, time-fit, filters, ranking, bundle composer
    services.py    recommendation pipeline, disruption/replan engine, demand signals, serializers
    nlp.py         intent parsing + vendor listing extraction (LLM with rules fallback)
    models.py      SQLAlchemy models (all spec entities + TravelTime lookup + AppState)
    seed_data.py   Jaipur seed: 11 places, static travel-time table, 5 vendors, 12 experiences, reviews, sample day
    seed.py        reset + seed script
  tests/smoke_test.py
frontend/
  src/pages/       RightNow, Timeline, ExperienceDetail, BundleSummary, Ask, Booking, TripSetup,
                   VendorChat, VendorConsole, LiveOps
  src/components/  DisruptionCard (live replan sheet), shared UI
  src/store.jsx    traveler state + WebSocket event handling
  src/live.js      WebSocket with auto-reconnect and 4s polling fallback
```

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/session/start` | create a session (location, date, group, accessibility, budget) |
| POST | `/session/intent` | parse free text into filters (`{"text": ""}` clears them) |
| POST | `/itinerary` | create an itinerary: `{"source": "sample" \| "fresh"}` |
| GET | `/itinerary/{id}` | timeline with gaps, statuses, pending disruption ids |
| POST | `/itinerary/{id}/gaps` | recompute gap slots |
| POST | `/itinerary/{id}/items` | place `experience_ids` into `slot_id` (1 = single, 2+ = bundle), or add raw `items` |
| GET | `/recommendations?slot_id=` | primary + 2 backups + optional bundle + exclusion counts |
| POST | `/disruption/trigger` | `unavailable` / `weather` / `time_shrink` / `budget_shrink` |
| GET | `/disruption/{id}/alternatives` | replacement card (re-solved live) |
| POST | `/disruption/{id}/resolve` | `{"action": "accept" \| "dismiss", "choice": "primary" \| "backup"}` |
| GET | `/disruption/pending` | polling fallback |
| POST | `/vendor/onboard` | chat answers → structured listing draft |
| POST | `/vendor/listings` | publish a confirmed draft |
| PATCH | `/vendor/{id}/status` | `open` / `closed` / `full` / `slots` (+ `slots_left`, optional `experience_id`); broadcasts over WS and replans affected travelers |
| GET | `/vendor/{id}/demand-signals` | nearby demand rollup |
| POST | `/booking/confirm` | mock booking; no payment is taken |
| WS | `/ws` | pushes `disruption`, `disruption_resolved`, `itinerary_updated`, `vendor_status`, `weather`, `demo_reset` |
