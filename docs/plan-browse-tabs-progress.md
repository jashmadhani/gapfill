# Plan tab / Browse tab / trip-planner port — progress & remaining work

Status as of this doc: **backend pipeline built and unit-tested, not yet
live-tested end-to-end, and no frontend UI built yet.** Nothing below has
been wired into the actual Plan/Browse pages a user would see.

## What exists now

**Backend (all live-tested):**
- `agent-service/app/planning/` - geo, dwell, scoring, sequencing, generator (ported from trip-planner; ratings/crowd signals dropped since Geoapify's free tier has none). 17 pytest tests pass.
- `POST /plan/generate` (form path) and `POST /plan/intake` (chat path) on agent-service. Live results: Jaipur/Udaipur/Goa/Pune trips generated with real places, one lunch + one dinner per day, hotel near the centroid.
- Generator fix made after first live run: first version produced 34 stops in one day (mostly restaurants). Now: max 4 activities/day, food separated out into one real lunch + dinner per day, junk/duplicate/non-ASCII names dropped.
- `POST /api/plan/generate` (browser, cookie auth) -> agent-service. Validates end >= start.
- `/api/chat/sessions/[id]/messages`: plan-tagged sessions go to `/plan/intake`; once a trip is produced `planTripId` is set and any further send returns 400 (server-enforced read-only). Optional `context` body field is forwarded to the agent as an ephemeral system message.
- `GET /api/browse/feed` - recommended (unvisited destinations first, then taste overlap) + "good weather ahead" (Open-Meteo forecast). Cached 1h per server instance.
- `/api/places/{search,geocode,nearby,detail}`, `/api/agent/plan/create` (unchanged from before).
- `/api/plan` now excludes `active` trips (they live on the Trip tab).

**Frontend:**
- `app/(app)/plan/page.tsx`: `?tripId=` -> plan detail; otherwise Browse | Plan sub-tabs (`?tab=`), `?place=&lat=&lng=` -> place detail, `?destination=` prefills the form.
- `components/plan/`: `browse.tsx` (search + 2 carousels + results), `place-detail.tsx` (weather, Wikipedia summary, "Plan a trip to X" button), `plan-tab.tsx` (form + "plan with AI" bar + your-trips chips), `plan-detail.tsx` (old editor view + hotel card), `floating-chat.tsx` (bottom-right toggle).
- Ask tab: history drawer shows a "Plan" badge and lock for read-only sessions; input disabled for them; opens the latest normal session by default.

## Decisions worth knowing

- Floating chat on the plan-detail page starts a NEW `normal` session (kept in localStorage per trip) rather than continuing the intake chat, so "plan chats are read-only once done" stays literally true. It appears in Ask history too.
- The second carousel is "Good weather ahead", not "upcoming events": there is no events data source in this app and none was faked. The UI says so.
- Recommendations use the seeded Rajasthan/Agra catalog only; anything beyond it comes from search.

## Known gaps / next steps

1. Visual QA in a browser at phone widths (nothing here has been looked at).
2. trip-planner features NOT ported: plan version history/restore, diff view, per-card edit/insert via chat, map view, SSE streaming of tool events. Plan generation is one blocking request (up to ~a minute).
3. Plan quality: activity pool depends on Geoapify categories; small towns return few sights, so days can be sparse. No opening-hours check, no budget-aware trimming (only a warning conflict).
4. `agent-service/app/next_client.py` docstring is stale (also used for `/api/places/*`).
5. `agent-service/README.md` should list `/plan/generate` and `/plan/intake`.
6. Vercel: agent `maxDuration` in `vercel.json` was raised to 120s to cover the 90s plan-generation timeout; that needs a Vercel plan that allows it.
