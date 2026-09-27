# Toure — full project architecture

This file exists so another AI (or engineer) with no other context can rebuild this app's structure, data model,
routes and UI/UX from scratch, correctly, on the first pass. It describes the state of the `ui/final-on-asif` branch.
Read `docs/AGENTS_AND_ML.md` alongside this for the ML models, datasets and agent design in depth — this file covers
routes, data, and UI/UX; that one covers agents and models.

## 1. What this app is

Toure is a trip-planning app: sign up, describe a trip (destination, dates, budget, who's going), get a day-by-day
itinerary built by a deterministic planner plus trained ML models for "will this person enjoy this place", talk to
an AI assistant that can read and change the trip, invite friends to a group trip with one admin, and book with a
human-approval payment gate (nothing is ever charged by the AI itself). A weather digital twin and a disruption
engine (rain, running late, a stop closing, budget cuts) round it out.

## 2. Stack

- **Frontend + API**: Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4. Runs as `web` in
  `vercel.json`'s multi-service blueprint.
- **Database**: MongoDB via Mongoose. One database per environment (dev uses a `toure_dev` name chosen in
  `MONGODB_URI`, distinct from any shared `test` database other branches/collaborators may be using).
- **Auth**: custom email+password (bcrypt) plus Google OAuth, a signed JWT session cookie (`jose`), no third-party
  auth service.
- **Agent service**: a separate Python FastAPI process (`agent-service/`), called by Next over HTTP with a
  short-lived JWT the two share a secret for (`AGENT_SERVICE_SECRET`). Runs as `agent` in the same Vercel blueprint,
  reachable only through that binding — it has no public route of its own.
- **LLMs**: Groq (`openai/gpt-oss-120b`) for the general trip assistant (LangGraph ReAct agent) and the trip-intake
  agent; Gemini (`gemini-flash-latest`) for a separate booking-and-ticketing agent, ported faithfully from an
  earlier design, with a deterministic rules fallback when no Gemini key is set. NuGen (an alignment platform) for
  an optional aligned mood-parsing model — see `docs/AGENTS_AND_ML.md`.
- **ML**: scikit-learn 1.9.1, bundled into `agent-service/app/ml` (satisfaction, crowd, mood models), trained on a
  mix of a real Kaggle dataset and synthetic travellers generated from hand-written priors.
- **Maps**: MapLibre GL (not Google Maps — no API cost), OpenFreeMap vector tiles, OSRM for real road geometry
  (cached), Geoapify for live place search/geocoding, Open-Meteo for weather.
- **No component library**: hand-rolled Tailwind components in `components/ui.tsx`, no shadcn/MUI/etc.

## 3. Repository layout

```
app/                      Next.js App Router: pages + API routes (see §5, §6)
  (app)/                  Route group behind the auth gate (layout.tsx redirects to /auth/login if no session)
    discover/ plan/ trip/ ask/ profile/ ops/digital-twin/
  auth/                   login, register, forgot-password (public)
  api/                    every backend endpoint (see §6)
  join/                   invite-link landing page (public)
  pay/[id]/               sandbox payment-provider checkout page
components/               shared UI: page.tsx (hero/body shell), ui.tsx (primitives), group.tsx (fit chips),
                          group/group-panel.tsx, plan/ (plan-detail, plan-tab, browse, left-out, approval-card,
                          pending-changes, floating-chat), route-map.tsx, day-timeline.tsx, chat-markdown.tsx,
                          coverflow.tsx, auth-shell.tsx, google-button.tsx, shell.tsx (AppShell nav)
lib/                      server-side logic: auth/ (session, password, google, validation, agent-jwt),
                          models/ (every Mongoose schema), db/mongoose.ts, payments.ts, disruptions.ts, group.ts,
                          safety.ts, trip-helpers.ts, seed.ts, places/ (geoapify, open-meteo, wikipedia), safe-next.ts,
                          schemas/chat.ts (the Next<->Python wire contract), api-client.ts (frontend fetch wrapper)
types/                    plain TS interfaces for everything that isn't on the Next<->Python wire
agent-service/            the Python service (see §7)
scripts/                  catalog.json (curated data) + seed-catalog.mjs (idempotent seeder),
                          copy-maplibre-worker.mjs (build step), export-agent-schemas.mjs (keeps the wire contract
                          in sync — run after touching lib/schemas/chat.ts)
docs/                     this file, AGENTS_AND_ML.md
```

## 4. Data model (MongoDB / Mongoose)

All models are `mongoose.models.X ?? mongoose.model<...>("X", schema)` (safe for Next's hot-reload). IDs below are
`mongoose.Types.ObjectId` unless noted.

### User (`lib/models/user.model.ts`)
`name, email (unique), homeCity?, phoneNumber?, auth: {passwordHash?, linkedAccounts[], emailVerified, lastLoginAt},
preferences: {groupTypeDefault, dietary[], accessibilityFlags[], budgetSkew, homeCurrency, preferredPace}`.

### Area (`area.model.ts`) — a destination/city
`areaId (unique string key, e.g. "jaipur"), name, region, imageUrl?, advisorySummary?`, plus catalog fields added
later (all optional, additive): `location {lat,lng}, tagline, description, tags[], idealNights, bestMonths,
hasAirport, hasRail`.

### POI (`poi.model.ts`) — a bookable experience/place
Core: `poiId (unique), name, description, category, tags[], activityType, location {lat,lng}, geo (GeoJSON Point,
2dsphere-indexed), locationKey?, areaId (ref Area), imageUrl?, openingHours (per-weekday "HH:MM-HH:MM" or "closed"),
typicalDwellMin {min,typical,max}, indoorOutdoor, groupSuitability[], accessibilityAttributes {step_free,
seating_available, restroom_onsite, sensory_friendly}, cost {min_expected_spend, typical_spend, currency}, bookable?
{vendorId?, pricePerHead, durationMin, capacityLeft}, crowdProfile[], advisoryNotes[], reviewCount, ratingAvg,
trustScore, trustMeta, computedQualityScore?, source ("vendor"|"google_places"|"wikimedia"|"seed"|"manual")`.
Added later: `attrs?` (intensity, stairs, walk_km, seating, shade, popularity, minAge, kidFriendly, bestTime,
closedWeekdays, openMin, openWindowMin — everything the ML fit model and the planner need), `vendorName?`.

### Hotel (`hotel.model.ts`)
`areaId (ref Area), areaKey, tier (budget|standard|premium|luxury), name, pricePerNight, rating`. Unique on
`(areaKey, tier)`.

### Trip (`trip.model.ts`) — one traveller's (or group's) trip
`tripId (unique), userId (ref User — the trip ADMIN), memberIds: ObjectId[] (friends who joined), inviteCode?,
suggestions: [{id, userId, userName, name, note, status: open|accepted|dismissed, createdAt}], votes: {[key]:
userId[]}, title, code, destination, coverImageUrl?, route: TripRouteStop[] (multi-city legs), startDate, endDate
(ISO date strings, not Date objects), groupType (solo|couple|family|large_group), group: {adults, children, members:
[{name, age?, stepFree?, interests?, userId?, role?}]}, themeTags[], totalBudget, totalSpent, currency, payments:
{total, paid, balance}, status (planning|upcoming|active|completed|cancelled), liveState?, coordinator?, checklist[],
risks[], changes: [{id, label, status: accepted|pending|kept, chosenLabel?}], timeline[], postTripSummary?`.

`status` drives the UI stage: `planning→"plan"`, `upcoming→"prepare"`, `active→"operate"`,
`completed|cancelled→"complete"` (`lib/trip-helpers.ts:stageOf`).

### PlanDocument (`plan.model.ts`) — one immutable version of an itinerary
`planId (unique), tripId, userId, version, parentPlanId?, status (active|superseded|discarded), days: EventCard[][]
(one array per day), hotel? {name, location, address?, rating?, priceLevel?, photoUrl?, source}, totalCost,
narrative, changeReason?, alternatives[], conflicts: [{level: error|warning, text}], notes: string[], considered:
ConsideredPlace[] (see below), fitSummary?: {fairness, members: [{name, age, band, stepFree?, avg, highlights[]}]}`.

**EventCard** (embedded, not a separate collection): `itemId (stable within a plan version), type
(travel|activity|meal|rest|accommodation|free_time|gap), startTime/endTime (ISO with a literal "Z" but meaning the
DESTINATION's local wall-clock time — see §9 pitfall), durationMin, poiId?, title, activityType, location?,
minExpectedSpend, typicalSpend, fitReason?, accessibilityIcons[], scoreBreakdown?, memberFits? (MemberFit[]),
groupFit?, crowd?, rating?, photoRef?, slotStart?/slotEnd?, locked, status
(suggested|confirmed|pending|disrupted|replaced|dismissed), booking? {bookingRef, pricePaid, headCount, bookedAt}`.

**ConsideredPlace** (embedded): every place the planner looked at and did NOT include — `poiId?, key, name, price,
priceSource (catalog|estimate), rating?, ratingCount?, durationMin?, tags[], imageUrl?, location, distanceKm?,
score?, memberFits?, groupFit?, crowd?, rank? (null for hard exclusions), verdict (left_out|excluded), reasons:
string[]` (up to 3, most decisive first).

**MemberFit** (embedded, in EventCard.memberFits and ConsideredPlace.memberFits): `name, age, band ("Adult" etc.),
fit (0-100), veto? (a hard reason this place is not for them, or null), reasons? (what holds their score back),
positive?`.

### ChangeEvent (`change-event.model.ts`) — a disruption's recovery options
`tripId, kind (weather|running_late|unavailable|budget_change|mood_change), label, reason, impact: string[], day?,
options: ChangeOption[], status (pending|resolved|dismissed), chosen? (the option key applied), source, reportedBy?`.
**ChangeOption**: `key, label, summary, changes: ChangeOp[], fit, costPerPerson, lostMin, score, recommended`.
**ChangeOp**: `op (swap|remove|shift), itemId, from?, poiId?, title?, price?, durationMin?, location?, imageUrl?,
minutes?, reason?`.

### PaymentIntent (`payment-intent.model.ts`) — the human-approval gate's core record
`intentId (unique), tripId, userId (the admin — only they may approve), kind (booking|balance|change), mode?
(deposit|full), eventId?/optionKey? (when kind="change"), amount, summary {title, subtitle, lines: [{label, amount,
strong?}], policy}, hash (of the plan+amount at quote time — re-checked at every step), status
(proposed|awaiting_payment|paid|executed|cancelled|expired|stale), createdBy (agent|traveller), providerRef?,
paymentId?, expiresAt (15 min from creation)`.

### Ticket (`ticket.model.ts`)
`tripId, itemId, title, startTime, holders, code (HMAC-signed "id.signature", verifiable without a DB round trip via
`verifyTicketCode`), status (valid|void)`.

### AgentAudit (`agent-audit.model.ts`)
`tripId?, userId, actor (agent|traveller|system), action, detail (secrets already redacted), outcome
(ok|blocked|error), intentId?`. Append-only; every agent tool call writes one row, allowed or blocked.

### ChatSession (`chat-session.model.ts`)
`sessionId (unique), userId, title, tag (normal|plan|booking), planTripId? (set once a "plan" session generates a
trip — makes it read-only), boundTripId? (which trip this session's agent calls resolve "current trip" to — see
§9), messages: ChatMessage[]`. **ChatMessage** (embedded, in `types/chat.ts`): `role (user|assistant), content,
toolCalls?, navigate?, createdAt`.

### ChatMemoryFact (`chat-memory.model.ts`)
Durable facts the assistant chose to remember (`remember_fact` tool) — not detailed further here; small and
self-explanatory in the model file.

## 5. Frontend pages (App Router)

| Route | Purpose |
|---|---|
| `/` (`app/page.tsx`) | Public landing page |
| `/auth/login`, `/auth/register`, `/auth/forgot-password` | Public auth screens; `?next=` carries a same-site-only redirect target (`lib/safe-next.ts`) back through sign-in, used by the invite flow |
| `/join?code=` | Public invite-code landing: enter or auto-fill a code, sign in/register if needed (round-trips through `?next=/join?code=...`), then POSTs `/api/groups/join` |
| `/discover` | Browse cities/experiences; also the app's landing page once signed in |
| `/plan` | Two tabs (`?tab=browse` / `?tab=plan`) when no `tripId`; with `?tripId=` shows `PlanDetail` — the single biggest page (see §8 for what's on it and the open question of moving parts to Trip) |
| `/trip` | The single "current" trip's live view (today's plan, route map, checklist, risks) — see `lib/trip-helpers.ts:resolveCurrentTrip` |
| `/ask` | General AI assistant chat, history drawer, now has a trip-picker (see §9) |
| `/profile` | Account details, settings, "Trips & groups" list with role badges + join-by-code box |
| `/ops/digital-twin` | Live weather + what-if simulator across the 12 catalog cities |
| `/pay/[id]` | Sandbox payment-provider checkout page for one `PaymentIntent` |

`app/(app)/layout.tsx` is the auth gate: server component, reads the session cookie, `redirect("/auth/login")` if
absent, otherwise renders `AppShell` (top nav on desktop, floating glass tab bar on phones — 5 tabs: Discover, Plan,
Trip, Ask, Profile).

## 6. API routes (all under `app/api/`)

Grouped by what they're for. Every route calls `requireUser(req?)` first; passing `req` also accepts the
agent-service's bearer token (see §7), omitting it accepts only the browser's cookie session — this distinction is
the security boundary for money routes (§9.3).

**Auth**: `auth/register`, `auth/login`, `auth/logout`, `auth/me`, `auth/google`, `auth/google/callback`.

**Trip data**: `plan` (GET list-my-trips-and-one-plan / POST create-draft / PATCH remove-or-lock-or-add-considered),
`plan/generate` (structured form → agent-service → persisted trip+plan), `trip` (GET current trip / PATCH
checklist/report actions), `discover`, `browse/feed`, `places/{search,nearby,geocode,detail}`, `profile`, `saved`,
`seed` (dev convenience).

**Groups**: `groups` (list mine), `groups/[tripId]` (detail — invite code only for the admin), `groups/join`,
`groups/[tripId]/members` (add by email / remove-or-leave), `groups/[tripId]/me` (edit own age/step-free/interests),
`groups/[tripId]/suggestions`, `groups/[tripId]/votes`.

**Payments** (cookie-session only — see §9.3): `payments` (GET list / POST propose-as-traveller),
`payments/[id]/{approve,pay,cancel}`, `tickets/verify` (public, no auth — a vendor checks a code).

**Disruptions**: `disruptions` (GET list / POST report from the app), `disruptions/[id]/choose` (admin applies an
option — goes through the payment gate), `disruptions/[id]/dismiss`.

**Chat**: `chat/sessions` (GET list / POST create, accepts `{tag, tripId?}` / PATCH rebind `{id, tripId}`),
`chat/sessions/[id]` (GET one), `chat/sessions/[id]/messages` (POST — routes to agent-service `/chat` or
`/booking/chat` by `session.tag`).

**Agent-only** (called by agent-service with its bearer token, using `requireUser(req)`; several also accept an
explicit `tripId`/`trip` query param so a bound session overrides the account-wide "current trip" default — see
§9): `agent/profile`, `agent/trips`, `agent/trips/[id]`, `agent/trips/history`, `agent/discover`, `agent/catalog`
(curated POIs for one destination), `agent/plan-cards` (a trip's people + day cards, for mood/disruption analysis),
`agent/plan/create` (persist a generated plan), `agent/payments`, `agent/payments/propose` (the ONLY money route the
agent can reach), `agent/disruptions`, `agent/twin` (proxies the digital twin so the browser never needs the
agent's token), `agent/memory`, `agent/audit` (write-only audit log).

## 7. agent-service (Python / FastAPI)

Entry point `app/main.py`. Auth: every request carries a bearer JWT Next minted (`AGENT_SERVICE_SECRET`,
`lib/auth/agent-jwt.ts` / `app/security.py`), verified before anything else runs.

```
app/
  main.py            FastAPI routes: /chat, /plan/generate, /plan/intake, /booking/chat, /booking/status,
                      /disruptions/trigger, /digital-twin/*
  agent.py           builds the general LangGraph ReAct agent (Groq) + the intake agent; sanitize_reply() strips
                      Unicode glyphs Groq's model mangles (₹, em-dash, curly quotes)
  booking_agent.py   the Gemini booking/ticketing agent, its own hand-rolled function-calling loop (not LangGraph),
                      with app/intent.py as its no-key rules fallback
  intent.py          regex/keyword classifier, no LLM — the deterministic fallback and disruption-report parser
  safety.py          redact() strips card numbers (Luhn-checked), CVV, PIN/OTP, passwords, API keys, Aadhaar-shaped
                      numbers from any text before it reaches a model or gets stored (lib/safety.ts is the TS twin)
  next_client.py     NextClient — the only way agent-service talks to Next; carries an optional trip_id and
                      substitutes it into every call (see §9.1)
  schemas.py         Pydantic wire-contract types, hand-kept in sync with lib/schemas/chat.ts (test_schema_contract.py
                      enforces it)
  digital_twin.py    live weather (Open-Meteo, cached) + a rule-based (NOT ML) what-if simulator; its "social
                      signals" are illustrative templates, explicitly marked as such, not a real feed
  ml/                bundled scikit-learn models (see AGENTS_AND_ML.md): infer.py, features.py, priors.py, train.py,
                      synth.py, data.py (Kaggle loader), mood_data.py, models/*.joblib
  nugen/             optional NuGen-aligned mood model: client.py, align.py (one-off CLI), build_dataset.py, mood.py
  planning/
    generator.py     the deterministic planner: geocode → catalog-or-Geoapify candidates → score → k-means cluster
                      into days → sequence with travel legs → record "considered" (left out) places
    catalog.py       curated-POI scoring, hard-exclusion reasons, left-out-reason generation
    fit.py           adapter onto ml/infer.py: normalise_members(), evaluate() (per-person + group fit, crowd)
    scoring.py       live-Geoapify-candidate scoring (destinations NOT in the curated catalog)
    sequencing.py    k-means day clustering, route ordering, EventCard construction, dwell/spend estimation
    geo.py, dwell.py helpers
    disruption.py    the disruption engine: analyse_weather/late/unavailable/budget, score_and_mark() options
    moodcheck.py     mood check-in: re-scores a day's stops with the reported mood as ML context, proposes swaps
  tools/             LangChain StructuredTools for the general agent: profile_tools, trip_tools, history_tools,
                      discover_tools, navigation_tools, memory_tools, mood_tools, ticketing_tools (the payment-gate
                      allowlist + Gateway class), disruption_tools
tests/               43 pytest tests: planning, disruption, fit, intent, ticketing-safety (allowlist/caps/audit),
                      schema contract
```

**Deploy**: `vercel.json` wires `web` and `agent` as two Vercel Services in one project;
`AGENT_SERVICE_URL`/`NEXT_INTERNAL_BASE_URL` are auto-injected there. Locally they're two processes:
`npm run dev` (port 3000) and `uvicorn app.main:app --port 8010` (`agent-service/.venv`).

## 8. UI/UX conventions (so a rebuild looks and feels the same)

**Design language**: photo-hero pages (`PageHero` in `components/page.tsx`) — a full-bleed photo, dual scrim, a
serif "display" title, content sliding up in a rounded sheet (`PageBody`) below it. `app-canvas` (a fixed
radial-gradient background, see `app/globals.css`) is shared by `<body>` and every sheet so there's never a colour
seam. A floating glass pill bottom nav on phones (`components/shell.tsx`), a plain top bar on desktop (`lg:` variant
inside the same `AppShell`).

**Typography scale**: `h2-section`, `h3-title` utility classes (defined in `globals.css`) — never ad-hoc
`text-lg`/`text-xl` for headings, so the hierarchy stays consistent across ~20 pages.

**Colour**: `rani` = brand blue, `stone` = neutral grey, `sand` = canvas background (Tailwind theme extension —
check `app/globals.css`'s `@theme` block for exact values before assuming standard Tailwind palette names apply).

**Group-fit chips** (`components/group.tsx`): `FitBadge` (a single %), `FitChips` (one pill per traveller + a
"Why" disclosure), `GroupFairness` (the "Works for everyone?" card). Used on every timeline card, every left-out
place, and the Plan sidebar.

**Maps** (`components/route-map.tsx`): MapLibre, day-tab switcher, hotel-to-stop-and-back on real roads (`/api/roads`,
OSRM, cached), numbered pins, dashed "ghost" pins for left-out places. MapLibre's own web worker must be copied into
`/public/maplibre` before dev/build (`scripts/copy-maplibre-worker.mjs`, wired as `predev`/`prebuild`) — Next's
bundler can't resolve it directly, a build-breaking gotcha worth flagging up front to anyone rebuilding this.

**Chat bubbles**: user messages render as plain text; assistant messages render through
`components/chat-markdown.tsx` (a small hand-rolled `**bold**`/`- bullet` renderer — no markdown library, no
`dangerouslySetInnerHTML`). Three separate chat surfaces reuse it: `/ask`, the Plan tab's "plan with AI" bar
(`plan-tab.tsx`), and the trip's floating chat (`floating-chat.tsx`, opened from a specific trip's page).

**Plan vs. Trip page — current split and the open question**: `PlanDetail` (`components/plan/plan-detail.tsx`)
currently renders, top to bottom: trip-switcher chips, `RouteMap`, hotel card, route/leg strip, budget card,
"how we planned this" notes, checks/conflicts, `PendingChanges` (disruption report buttons + options),
`ApprovalCard` (waiting payment approvals + tickets), `GroupFairness`, `GroupPanel` (members/invite/ideas/votes),
then the full day-by-day `DayTimeline` for every day, then the sticky book bar. This is everything about a trip in
one page regardless of its status, and gets very long once a trip is booked. `TripPage` (`app/(app)/trip/page.tsx`)
is meant to be the live/"happening now" view but currently only shows: risks, a "show full trip / today only"
toggle over `DayTimeline`, `RouteMap` (added ported-in), report-change buttons, coordinator card, changes log. A
sensible split (not yet implemented — flagged for whoever picks this up): once `trip.status` is `upcoming` or
`active`, `PlanDetail`'s route/hotel/budget/day-by-day content is redundant with `TripPage`'s — Trip should own
"what's happening now and today" (today's route map, current/next stop, checklist, risks, coordinator), and Plan
should keep "the trip as a designed artefact" (the multi-city route strip, cost breakdown, group/invite management,
pending disruption decisions, the full multi-day timeline for editing before it's locked in) — with a prominent
link between them once a trip is booked, rather than one page trying to be both.

**Fit chips only show for catalog destinations**: the per-person `%` fit numbers and hotel/considered data only
appear when a trip's destination matched one of the 12 curated catalog cities at generation time (`scripts/catalog.json`
via `scripts/seed-catalog.mjs`) — anything else (a city typed that Geoapify resolves but the catalog doesn't cover)
falls back to the plain live-Geoapify pipeline with no ML fit, no hotel suggestion, and rougher "estimate"-tagged
prices in the left-out list. This is by design, not a bug — worth stating plainly in any rebuild's scope decision
(expand the catalog, or accept the two-tier experience).

## 9. Sharp edges and cross-cutting fixes already made (read before touching these areas again)

1. **"Current trip" resolution vs. an explicitly bound trip.** `lib/trip-helpers.ts:resolveCurrentTrip()` picks
   one trip per *account*, not per conversation (active → soonest upcoming → most-recently-touched draft). Every
   agent tool used to call it with no override, so a traveller holding more than one trip could ask the assistant
   to book "this trip" and have the action silently apply to a different one than the page they had open — the
   plan looking "static" was this bug, not a caching problem. Fixed by: `ChatSession.boundTripId` (set
   automatically when a chat opens from a specific trip's page, or picked in a dropdown on `/ask`), forwarded as
   `tripId` on `AgentChatRequest`/`BookingChatRequest`, and `NextClient(trip_id=...)` substitutes it for every
   `"current"`/absent trip parameter on every call it makes — so the override is enforced server-side, not just
   hinted to the model. If you add a new agent tool or Next route that resolves "the trip", make it accept an
   explicit id (query `trip`/body `tripId`) with `resolveCurrentTrip` only as the fallback, or this bug reappears.
2. **The Next↔Python wire contract is checked twice, in two different failure modes.** `lib/schemas/chat.ts` (zod)
   is authoritative; `agent-service/app/schemas.py` (Pydantic) must match field-for-field, camelCase, no aliasing;
   `test_schema_contract.py` catches a Python-side drift. But a *Python-side response that simply returns the wrong
   shape* (e.g. `{name, input}` instead of `{name, args}` for a tool-call log) fails zod's `.parse()` in Next
   silently into a generic catch block ("I couldn't reach the assistant service"), even though the Python side
   returned 200 and had already taken a real action (e.g. proposed a payment). This exact bug shipped once. If a
   chat reply is a generic fallback message but a downstream effect (a payment intent, a change event) actually
   happened, suspect a response-shape mismatch first, and check both processes' logs, not just Next's.
3. **Money is deliberately not reachable from the agent's bearer token.** `requireUser()` accepts either a browser
   cookie session or (only when `req` is passed AND a bearer token is present) the agent's short-lived JWT. Every
   route under `app/api/payments/*` calls `requireUser()` with **no** `req` argument — a hard, intentional
   structural guarantee that no code path from agent-service can approve, pay, cancel or read raw payment details,
   independent of what the LLM is told to do. Do not "fix" this by threading `req` into those routes.
4. **Card times are destination-local wall-clock, stored with a literal `"Z"`.** `EventCard.startTime` etc. are
   `"2026-11-10T09:00:00.000Z"` meaning "9am at the destination", not UTC. Every place that formats them for display
   must read them back with `timeZone: "UTC"` explicitly, or they shift by the viewer's local offset
   (`components/day-timeline.tsx:fmtTime` does this correctly — copy that pattern, don't reinvent it).
5. **iOS Safari renders an empty `<input type="date">` with no placeholder text at all** — it just looks blank/
   broken, unlike a text input. Give date pickers a sensible default value instead of `""`.
6. **MapLibre's web worker** must be present at `/public/maplibre/maplibre-gl-worker.mjs` before the map will render
   at all (silent failure otherwise: tiles never load, no console error pointing at the real cause) —
   `scripts/copy-maplibre-worker.mjs` handles it as a `predev`/`prebuild` step; don't remove that wiring.
7. **`resolveCurrentTrip` and the Plan-page trip list use different queries** (`Plan`'s own trip strip only shows
   `status: {$in: ["planning","upcoming"]}`, excluding `active`) — expected, since Plan is for trips not yet
   underway, but worth knowing when debugging "why isn't my trip in this list" reports.
