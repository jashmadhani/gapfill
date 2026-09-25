# Assumptions & judgment calls

The items that most need your review come first.

## 1. Stack and infrastructure

| Topic | Decision |
|---|---|
| **Database** | **SQLite is the default** (`backend/gapfill.db`), so `./dev.sh` needs no setup. PostgreSQL is fully supported through `DATABASE_URL=postgresql+asyncpg://…`. The smoke test passes on both SQLite and a local Postgres 16. JSON columns use SQLAlchemy's generic `JSON` type, so one schema serves both. |
| **LLM** | **No API key was available in the build environment, so every run so far used the rules-based fallback.** The Anthropic Messages API path (model set by `GAPFILL_LLM_MODEL`, called over plain `httpx`) is implemented but has **not been exercised against the live API**. Any error or timeout (12s) falls back to rules without breaking the flow. Rules coverage: category keywords, mood words ("chill", "bored"), price caps ("under ₹500", "cheap"), duration caps ("quick", "under 1 hour"), indoor cues ("rain", "too hot"), plus regex extraction of price, duration, capacity, hours, area, access features and group fit from the vendor chat. |
| **Realtime** | Realtime uses a native FastAPI WebSocket (`/ws`) with a single broadcast hub. The client reconnects automatically and **polls `/disruption/pending` every 4s while the socket is down**. The hub broadcasts to every connected client, with no per-user channels, because there is only one mock traveler. |
| **Frontend** | The frontend uses React 19 + Vite 8 + Tailwind v4 (through `@tailwindcss/vite`), with react-router and lucide icons. The Vite dev server proxies `/api` and `/ws` to `:8000`, so no CORS setup or env vars are needed. |
| **Migrations** | There is no Alembic. `python -m app.seed` drops and recreates all tables. That is fine for a hackathon demo, but not for production data. |

## 2. Core algorithm interpretations

- **Time fit.** The rule is `travel_to + duration + travel_back + buffer ≤ slot length`, where `buffer = max(10, 15% of slot)`. The code also checks **opening hours**: if the traveler would arrive before opening, they wait, and the activity must end by closing time. "Travel back" means travel to the **next** commitment's location, not to the hotel.
- **Budget.** `budget_envelope` is **₹ per person for the whole day's discretionary experiences**. A slot's budget = envelope − the prices of the other planned experiences. The mock booking total is price × headcount (solo 1, couple 2, family 4, large group 8).
- **Capacity.** A listing counts as available only if `vendor.status == open` **and** `capacity_left ≥ group headcount`. So "2 slots left" makes a listing unavailable for a family of 4. Every booking decrements capacity by the headcount.
- **Trust score.** The recency weight is `e^(-λ·days)` with `λ = ln2/90` (the weight halves every 90 days exactly). The score is cached on `Experience.trust_score` and recomputed only on seed or on a new review (`POST /experiences/{id}/reviews`). It is never recomputed per request. A new listing with no reviews starts at 3.5. The seed includes a deliberate case: the *Fort Zipline* has glowing old reviews but poor recent ones, so its plain average is 3.7 and its trust score is 2.5.
- **Relevance multiplier** = `1 + 0.3 × (number of overlapping intent tags, max 3)`. Ranking score = trust × relevance. Ties go to the option with less total travel.
- **Bundle composer.** The composer sorts by `(trust × relevance) / price` and adds items greedily. It only keeps an item if the whole chained route (origin → A → B → next commitment), including opening hours and the buffer, still fits the slot and the budget. The maximum is 3 stops. A bundle is shown only when it has 2 or more items. The primary card is always the single best experience, and the bundle is an optional "Make it a combo" link.
- **Gap detection.** A gap is idle time of ≥ 45 min between consecutive *occupying* items, meaning any non-gap item that is not `replaced`. A gap whose start and end are unchanged keeps its id when gaps are recomputed, so the UI's `slot_id` stays valid.
- **Fresh (blank) itinerary.** A blank day with no commitments would have no gaps. It is therefore anchored by two zero-length "Day starts / Back at base" items at the session window edges, which makes the whole day one open gap.
- **Hard filters.** These filters always apply: group type, **every** selected accessibility flag, availability, weather (bad weather allows `indoor` only, not `mixed`), intent `max_duration`, intent `max_price`, and experiences already in the plan.

## 3. Disruption and replan engine

- Every trigger re-solves the **original slot** of the affected item. The slot is stored on the item as `slot_start`/`slot_end` when the item is placed. The engine always excludes the original experience and returns exactly **1 primary + 1 backup**. Alternatives are **recomputed on every GET**, so a card reflects availability changes that happened after the card was pushed.
- **Only planned items that still lie ahead of the demo clock are disrupted.** Only items that hold an experience are affected. Fixed bookings such as Amber Fort are never auto-replaced.
- Each trigger does the following:
  - `unavailable`: sets a listing's capacity to 0, or closes a vendor. `PATCH /vendor/{id}/status` runs the same scan, so a vendor tapping *Closed* or *Fully booked* replans travelers automatically.
  - `weather`: flips the global flag. Every upcoming **outdoor** item gets an indoor-only replan.
  - `time_shrink` ("running late"): delays the slot start by N minutes. **If the same experience still fits, the engine just shifts it and sends a note, with no card.** Otherwise it replans with a shorter option. A "Running N min behind" block fills the lost time so that time does not appear as bookable free time.
  - `budget_shrink`: sets the new envelope. If the plan is now over budget, the **most expensive upcoming item** is replanned within the remaining budget. Only one item is replanned per trigger.
- **Dismiss** keeps the original plan for weather, late and budget triggers; a late dismiss shifts the item by the delay. For `unavailable`, the item cannot be kept, so dismiss marks it `replaced` and the window reopens as a gap. A new pending event for the same item supersedes the old one (the old one is marked dismissed).
- `replaced` is used for "no longer in the plan", which covers both swapped items and removed items.

## 4. Scope simplifications

- **No auth** (as specified). There is one mock traveler, and the "active" session and itinerary live in a single-row `AppState` table, so the Ops view and the traveler iframe share state.
- **Demo clock.** The clock is a manual `HH:MM` setting (default 11:30), not the real time. It decides which gap counts as "Right Now" and which items are in the past.
- **Maps.** Travel times come from a static, symmetric lookup table (`TravelTime`, 11 Jaipur places). The values were generated once from haversine distance × 1.3 at 20 km/h + 5 min and then hard-coded in `seed_data.py`. A listing published after seeding uses the same formula at runtime because it is not in the table. The chat extractor maps areas to the 11 known places; an unrecognized area defaults to MI Road and is flagged in `needs_review`.
- **Weather** is a toggle in Live Ops. No weather API is called.
- **Booking and payment** are mocked: a random `GF-XXXXXX` reference and a capacity decrement. No payment is taken.
- **The vendor chat is simulated in-app.** There is no WhatsApp API. Status changes happen in the console, not through chat replies.
- **Demand signals** are daily counters keyed `area:<place>` (intent tags from traveler queries) and `vendor:<id>` (`shown` / `added` / `booked`). The seed adds some baseline area demand so the strip is not empty.
- **The "Not this one" skip list** lives in `sessionStorage` on the client. It is not persisted on the server.
- **Currency** is INR only. `home_currency` is stored but not converted.
- **Accessibility** is self-declared by vendors and is not verified.
- The **Bundle** row is persisted when a combo is booked. It is not used to replan bundles as a unit: each stop is its own itinerary item and is disrupted independently.
