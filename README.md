# TourCraft

TourCraft is a personalised, dynamic tour planning and tour operations platform. It was built for HackCelestial 3.0, **PS-7: Personalized Dynamic Tour Planning & Tour Operations Platform**.

Travelers design their own tour instead of picking a fixed package. They set dates, budget, stays, transport, interests and travel style, and get an optimised day-by-day plan. They can swap any part of it, book everything in one go, and receive live recovery plans when something changes on the road. Operators run every customised tour from one console: customers, bookings, vendors, coordinators, payments, schedules and changes. Vendors confirm bookings and update availability from a mobile portal.

The whole lifecycle is covered: **Discover → Personalize → Plan → Price → Book → Prepare → Operate → Assist → Adapt → Complete → Review**.

Planning is **group-aware and ML-driven**. You describe the group as people (a 5-year-old, a 20-year-old, a 45-year-old and a 68-year-old who needs step-free access). Trained models predict how much each person will enjoy each place at a given time, crowd, heat and mood. The planner then builds a day that is fair to everyone, and explains every choice, including what it left out and why.

Everything runs offline and deterministically; the models ship pre-trained. The trip assistant can optionally use Claude (see below).

## Quick start

Requirements: Python 3.11+ and Node 18+.

```bash
./dev.sh
```

On first run, the script creates the Python venv, installs the npm packages, seeds the database and starts both servers. It works in macOS/Linux shells and in Git Bash on Windows. Then open:

| Surface | URL |
|---|---|
| Traveler app (mobile-first) | http://localhost:5173 |
| **Live Ops demo view** (traveler + vendor phones side by side, plus disruption triggers) | http://localhost:5173/ops |
| Operator console | http://localhost:5173/operator |
| Vendor portal | http://localhost:5173/vendor/1 |
| Switch traveler / tour | http://localhost:5173/tours |
| API docs (Swagger) | http://localhost:8000/docs |

### Manual setup

```bash
# backend
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt          # Windows: .venv\Scripts\pip
.venv/bin/python -m app.seed                        # (re)create tables + demo data
.venv/bin/uvicorn app.main:app --reload --port 8000

# frontend (second terminal)
cd frontend
npm install
npm run dev                                         # proxies /api and /ws to :8000
```

The default database is SQLite (`backend/tourcraft.db`). To use Postgres, set `DATABASE_URL=postgresql+asyncpg://localhost/tourcraft`.

To use Claude in the trip assistant, set `ANTHROPIC_API_KEY` (and optionally `TOURCRAFT_LLM_MODEL`). Claude then classifies free-text requests. Without a key, or if the call fails, the assistant uses its rules-based parser, so it never breaks.

### Tests

```bash
cd backend && .venv/bin/python -m tests.smoke_test
```

The smoke test runs the whole lifecycle through the API:

- Discover
- Plan with budget optimisation
- Compare and swap (activity, hotel, transfer)
- Book
- All six disruption triggers, each resolved
- Vendor confirm and close
- Eight assistant intents
- Every operator endpoint
- Review
- Group-aware planning: a three-generation group with a step-free senior. The test asserts nobody is ever booked into something unsafe for them, rest blocks exist, and the "considered, not added" list is populated.
- Mood check-in from free text, the ML endpoints, and that swaps, additions, removals and reviews produce feedback rows for retraining

To retrain the models (about 1 minute):

```bash
cd backend && .venv/bin/python -m app.ml.train
```

## Requirements → what was built

The primary requirements below come from the problem statement. Each one is implemented.

### Traveler side

| # | Requirement | Where / how |
|---|---|---|
| T1 | **Discover** destinations & experiences | `Discover` tab: interest chips re-rank destinations (with reasons such as "Great for food, heritage · 6 experiences match you") and experiences. Destination and experience pages show hotels by tier, opening hours, closed days, accessibility, ratings and reviews. |
| T2 | **Personalize**: destinations, dates, duration, budget, accommodation, transport, interests, travel style | `Personalize` form: start city, date, days, adults and children, total budget (with per-person-per-day hint), destinations (optional; leave empty and TourCraft picks), 12 interests, hotel tier, transport (best / car / train / flight), pace (relaxed / balanced / packed), step-free need. |
| T3 | **Create their own tour, not a fixed package** | Planner (`backend/app/planner.py`) orders the stops by nearest neighbour and allocates nights by interest weight. It picks hotels by tier and accessibility, and transfers by mode preference or a time-value trade-off. It then schedules each day's activities around opening hours, closed weekdays, local travel time, arrivals and departures, kids and step-free needs, and forecast rain. |
| T4 | **Optimized itinerary** | Greedy scheduling scored on interest match, rating, popularity and price. **Optimise** brings the plan under budget with the lowest-impact savings first (cheaper mode → hotel tier down → drop the lowest-value activity) and explains each step ("How we optimised this"). **Regenerate** rebuilds from preferences. |
| T5 | **Select / modify components & compare alternatives** | Every item has **Compare & swap**. Activities show the alternatives that fit that exact window, hotels show the other tiers, and transfers show the other modes with arrival time and clashes. Each alternative shows the price delta incl. taxes, rating and fit reasons. Travelers can also add experiences to any day (auto-slotted) and remove items. |
| T6 | **Estimated costs** | Live price vs budget on the Plan screen. The `Price` screen breaks the total down by stays, transfers, experiences and change fees, plus 8% coordination fee and 5% GST, per person and per day. |
| T7 | **Complete bookings** | One tap books every component with its vendor (booking refs per component). The traveler pays a 30% deposit or in full; a coordinator is auto-assigned by load and base city. Booking is blocked while hard conflicts exist. |
| T8 | **Access complete travel plan** | `Plan` (day by day, stays per night, refs, vendor confirmation status, change history) and `Trip` (vouchers). |
| T9 | **Prepare** | Countdown, pre-trip checklist (ID, vouchers, balance auto-ticks when paid, coordinator, insurance, packing tips derived from the route), vouchers with confirmation state, and proactive risks. |
| T10 | **Operate / Assist during the journey** | `Trip` shows "Happening now / Up next", today and tomorrow, proactive heads-up (rain on outdoor plans, tight connections, unconfirmed vendors within 48h, declined bookings, long-transfer fatigue), coordinator call, and one-tap "Running late" / "It's raining" / "New budget". |
| T11 | **Conversational assistant** | `Assist` chat understands schedule, costs, add, remove, cheaper or better hotel, lighter day, running late, raining, weather and call-coordinator requests. It acts on the real tour, with rebooking and fees. |
| T12 | **Complete → Review** | Trip summary, then an overall rating plus a per-experience rating. Ratings flow into vendor scores and future recommendations. |

### Operator side

| # | Requirement | Where / how |
|---|---|---|
| O1 | Centralised environment for **multiple customised tours** | `/operator` dashboard: KPIs (on tour now, upcoming, open changes, pending vendor confirmations, revenue, collected, margin, rating), lifecycle pipeline, proactive alerts across all tours, pending changes, analytics (revenue mix, nights by destination, traveler interests, busiest vendors) and a table of all tours. |
| O2 | **Customers, tour groups** | `Customers & team`: customers with segment, interests, tours and lifetime value; groups with members and size. |
| O3 | **Bookings, vendors, hotels, transport, activities** | Tour detail shows every component with vendor, ref, price and confirmation state ("Confirmed by phone" button). `Vendors` lists hotels, transport and experience partners with rating, load, booked value and pending confirmations, and has an open/closed toggle. |
| O4 | **Coordinators** | Auto-assignment on booking; reassign from tour detail; coordinator cards with active tours, on-the-road count and open tasks. |
| O5 | **Payments** | Per-tour financials (cost breakdown, operator margin, ledger, balance or credit), recording payments and refunds, and an all-tours payments view. |
| O6 | **Schedules** | `Today's operations`: every tour on the road for a date, with day N/M, city, stay, what's happening now, vendor and confirmation per item, and rain flags. |
| O7 | **Itinerary changes & coordinating providers** | `Changes`: pending changes with impact analysis and the same recovery options the traveler sees; the operator can approve on the traveler's behalf. Full audit history. `Coordination` queue: auto-generated tasks to confirm, cancel, reschedule/notify vendors, call back travelers and absorb comp-upgrade costs. |
| O8 | **Visibility of both journeys** | "Open as traveler" from any tour; Live Ops shows the traveler and vendor phones side by side. |

### Dynamic tour management (Adapt)

`backend/app/adapt.py` handles each trigger in three steps:

1. **Impact analysis.** It identifies the directly affected component and its downstream effects, for example activities you would miss after a late train, or a hotel that must hold the room.
2. **Recovery options.** It generates 2–3 feasible options.
3. **Scoring.** It scores each option on cost change (incl. cancellation fees per policy), time lost, number of components touched, and preference fit. One option is marked **Recommended**.

The traveler gets a live bottom-sheet card to compare and apply an option; the operator sees the same card. Applying an option rebooks vendors, retires old bookings, applies fees or waivers, creates coordination tasks and logs the change.

| Trigger | Options generated |
|---|---|
| Weather (rain on a city/day) | Indoor swap (re-sequences the day if needed) · Move to a dry day · Leave it free (weather waiver) |
| Provider can't deliver / vendor closes / vendor declines | Best replacement · Alternative pick · Leave it free (full refund) |
| Transport delay | Wait & re-sequence the day · Switch to car / flight · Move missed activities to another day |
| Transport cancelled | Rebook on each available alternative mode, re-timing the day |
| Hotel overbooked | Free upgrade (operator absorbs the cost) · Similar hotel · Cheaper tier with refund |
| Traveler running late | Shift the day · Skip & stay on time · Do it another day |
| Budget change | Downgrade stays · Trim experiences · Balanced (iterates until the real total, incl. fees, fits) |

**Cancellation policy.** Only traveler-initiated changes are charged:

- Activities: free up to 24h before, 50% after.
- Hotels: free up to 72h before, 1 night after.
- Cars: free up to 24h before, 25% after.
- Trains: 10% clerkage, 25% inside 24h.
- Flights: ₹3,000 per person.

Vendor, weather and transport disruptions are waived under the operator's disruption cover.

### Vendor side

The vendor portal (`/vendor/:id`) has:

- Confirm or decline booking requests. A decline instantly triggers replanning for the traveler.
- A one-tap Open/Closed switch. Closing replans every affected upcoming tour.
- Mark a single listing full, or reopen it.
- Notifications from the operator (cancellations, reschedules, late arrivals).
- Stats: bookings, booked value and rating.

## Group-aware planning and the ML models

### What the traveler sees

- **The group as people.** Personalize collects each traveler's name, age, optional personal interests, step-free need and afternoon-rest need. Presets include "3 generations" (5 / 20 / 45 / 68). A free-text mood box ("the kids are restless and we're tired") is read by the mood model as you type.
- **Per-person fit on every experience.** Each item shows one chip per traveler with their predicted enjoyment (for example `Aarav 5 · 84%`, `Paati 68 · 89% ★`), or "not for them" when a safety rule applies. **Why** explains the prediction, e.g. "held back by lots of stairs, midday heat".
- **Fair days.**
  - The group score is 60% of the weighted average plus 40% of the least-happy member.
  - A fairness tracker boosts whoever has been under-served on later days.
  - The pace follows the most vulnerable member: fewer stops, one high-intensity stop a day, and an earlier finish for young children and seniors.
  - **Rest blocks** are added automatically, e.g. "Afternoon break for Aarav (5), Paati (68) during the hottest hours".
- **Split tracks.** When the best option for part of the group can't include everyone (age limit or stairs), the planner runs two experiences in parallel with a meeting time. Example: an Ayurvedic spa for the adults while 7-year-old Tara visits the car museum, meeting at 1:23 PM.
- **"Considered, not added".** For every city, every experience the planner evaluated but didn't pick is listed, with its group fit, per-person chips and the exact reason:
  - "Not for Aarav (5): minimum age 6. Works as a split track for Rohan, Meera, Ishaan, Paati."
  - "Group fit 56%: below everything planned here."
  - "Your day in Jaipur is already full."
  - "Would take you ₹4,200 over budget."
  - "Closed on Friday."

  Each entry has **Add** (auto-slotted into a day) and **Replace…** (pick what it replaces and see the predicted fit gain).
- **Smart tags with advice.** Generated from the model outputs, each with a comment and, where useful, a one-tap fix:

  | Tag | Example advice |
  |---|---|
  | Overcrowded | "Skip it: X is only 30% busy then and suits your group (84% fit)" → **Go to X instead**, or "Much quieter around 8 AM" → **Move to 8 AM** |
  | Midday heat | "Hot and exposed at this hour: hard on Paati (68). Mornings are cooler." |
  | Hidden gem | "Rated 4.9★ by the few who find it, and rarely busy." |
  | Best at sunrise | Quietest and best light early in the morning |
  | Kid favourite / Senior-friendly | Who in your group will love it; seating and few stairs |
  | Pricey for the fit | High price for a low group fit |
  | Book ahead | Very popular or small capacity |

- **Daily mood check-in** (Trip tab or the assistant: "we're exhausted"). The mood model reads the text and the rest of the day (or tomorrow, if nothing is left today) is re-scored. The traveler gets options through the usual change card: *Tune the day to the mood*, *Make it a lighter day* (drop the most tiring stop and add a rest break) or *Add something* when the group feels energetic.
- The experience page shows **How it suits your group** (per-person fit, best time, tags) and the **hourly crowd forecast**. Compare and Discover show group fit too.

### The models (`backend/app/ml/`)

| Model | Predicts | Algorithm | Held-out result |
|---|---|---|---|
| Satisfaction | One person's enjoyment (1–5) of one place, given age, interests, step-free need, mood, time, crowd, heat, rain | `HistGradientBoostingRegressor` | MAE **0.32** on places never seen in training (predict-the-average: 0.65; Google-rating-only: 0.61), R² 0.76 |
| Crowd | Busyness 0–100 by hour, weekday, month, weather | `HistGradientBoostingRegressor` | MAE 5.5 points, R² 0.88 |
| Mood | Mood labels from free text | TF-IDF (words + characters) + one-vs-rest logistic regression | F1 0.89 on hand-written sentences it never saw |

**Hard safety rules are never left to a model.** Minimum age, stairs for someone who needs step-free access, and places not suitable for young children are vetoes. The model predicts enjoyment; the rules decide eligibility; the planner decides the day.

### Training data

1. **Real data.** The Kaggle *Top Indian Places to Visit* dataset (325 attractions with Google ratings, review counts, entrance fees, visit durations, best time and weekly offs) is at `app/ml/data/`.
   - It supplies the population of real places the models learn from.
   - 16 of its attractions in our cities (Red Fort, Qutub Minar, Hawa Mahal, Jaigarh Fort…) are imported into the catalogue as self-guided visits.
   - It supplies popularity for curated experiences it matches.
2. **Expert assumptions** (`app/ml/priors.py`), documented and editable:
   - life-stage profiles (energy, stairs, heat and crowd tolerance, walking, attention span, bedtime)
   - how much each life stage enjoys each kind of place
   - physical profiles per place type
   - hourly crowd patterns by category, season multipliers and midday heat by month
   - the effect of each mood

   Curated experiences also carry expert-assessed effort, stairs, walking, seating, shade and minimum age (`catalog.py`).
3. **Synthetic data** (`app/ml/synth.py`). Simulated travelers "visit" the real places:
   - 120,000 satisfaction rows and 60,000 crowd rows, scored by a latent function built from the priors plus noise and personal taste.
   - A mood corpus of 6,000 sentences built from expert phrases.
4. **Real feedback** (`feedback` table). Every review, swap-in, swap-out, addition and removal stores the exact model input and an implied rating. **Retrain** (operator console → Planning model) mixes these in at 5× weight, so the model drifts from the priors toward how real travelers behave.

Evaluation holds out whole places, not rows. Eleven hand-written **behaviour tests** must pass after every retrain, for example:

- "a 5-year-old scores a zipline with minimum age 10 near the floor"
- "midday May heat hurts a senior outdoors more than a January morning"
- "a tired mood lowers an intense fort"

**Operator console → Planning model** shows:

- training data by source
- accuracy against the baselines
- behaviour test results
- permutation feature importance
- a heatmap of what the model learned (life stage × kind of place)
- the mood model's reading of the natural sentences
- a **playground** where you set age, time, month, rain, step-free and mood and watch a prediction and its reasons change
- version history, with a **Retrain** button

## 2-minute demo script

1. Open **/ops** and press **Reset demo data**. It is day 2 of Aanya's *Royal Rajasthan for Two* (Jaipur → Jodhpur → Udaipur), 11:30 AM.
2. **Weather → Make it rain** (Day 2 · Jaipur). The traveler phone shows the card: the outdoor Nahargarh sunset is affected. Option A swaps in the indoor block-printing workshop at the same time. Apply it; the vendor gets a cancel task and the new vendor gets a confirmation request.
3. **Transport → Delay 120 min** on the day-3 train. The impact lists the photo walk you would miss and the hotel's late check-in. Compare "Wait it out" (drops the walk, refund) with "Switch to car" (+₹4.8k, nothing lost).
4. In the **Vendor** phone, **Decline** a request. The traveler immediately gets replacement options.
5. **Cut budget** to ₹90,000. Compare downgrade stays / trim experiences / balanced, with the "still over budget" flag.
6. Open **/operator**. The dashboard, alerts, change history, coordination tasks and payments all reflect what just happened.
7. On the traveler app, go to **Discover → Design your own tour → Build my tour → Optimise → Compare & swap → Review price & book** to run a brand-new tour from scratch.
8. Visit **/tours** and open *Golden Triangle Classic* (completed) to leave a review.
9. **Group-aware planning:** in **/tours** open *Three Generations: Tigers & Forts* (Rohan 45, Meera 43, Ishaan 20, Aarav 5, Paati 68 with step-free needs).
   - On **Plan**, see *Works for everyone?* (per-person predicted enjoyment and fairness), per-person chips on every stop (tap **Why**), rest blocks, and *Considered, not added* (Amber Fort: "too many stairs for Paati"; block printing: "minimum age 6: works as a split track").
   - On **Trip**, check in "The kids are cranky and everyone is exhausted" and compare *Tune the day* with *Make it a lighter day*.
   - *Lakes & Palaces Getaway* (upcoming) shows a **split track**: spa for the adults while Tara (7) visits the car museum.
10. **Operator → Planning model:** walk through the data, accuracy, behaviour tests and the heatmap, then use the playground: set age 68, 1 PM, May and watch the fit drop with "midday heat".

## Tech

| Part | Stack |
|---|---|
| Backend | FastAPI, SQLAlchemy async (SQLite / Postgres), WebSocket hub for live updates |
| ML | scikit-learn (gradient boosting, TF-IDF + logistic regression), NumPy, joblib |
| Frontend | React 19, React Router, Tailwind v4, lucide icons, Vite |
| Live channel | WebSocket with auto-reconnect and a 4s polling fallback |

Backend modules:

| File | Responsibility |
|---|---|
| `backend/app/catalog.py` | Seed catalogue: 8 destinations, 46 curated experiences (+16 imported from Kaggle), 32 hotels, 3 transport partners, customers, coordinators, expert place profiles |
| `backend/app/ml/` | Kaggle data, expert priors, synthetic data generator, training + evaluation, inference (per-person fit, explanations, crowd, mood) |
| `backend/app/insights.py` | Per-person fit chips, smart tags with advice, "considered, not added", fairness summary, feedback logging |
| `backend/app/planner.py` | Recommendations, routing, group-fair ML scheduling (vetoes, rest blocks, split tracks), pricing, optimisation, conflicts, alternatives |
| `backend/app/adapt.py` | Disruption impact analysis and recovery options |
| `backend/app/customize.py` | Swap, add, remove, optimise, regenerate |
| `backend/app/assist.py` | Trip assistant |
| `backend/app/services.py` | Lifecycle stage, booking, payments, tasks, cancellation policy, risks, checklist, serialisation |
| `backend/app/main.py` | REST + WebSocket API |
