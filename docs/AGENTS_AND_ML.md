# Agents, models and data

A plain account of what runs where, for anyone who has to explain it.

## Agents (agent-service, Python + LangGraph, Groq `openai/gpt-oss-120b`)

| Agent | Job | Tools |
|---|---|---|
| Trip assistant (Ask tab) | Answers from the traveller's real data and acts inside guard rails | `get_my_profile`, `list_my_trips`, `get_trip_details`, `summarize_past_trips`, `search_experiences`, `remember_fact`, `navigate_app`, `mood_check_in`, `get_payments`, `propose_booking`, `propose_balance_payment`, `report_weather`, `report_running_late`, `list_pending_changes`, `propose_change_option` |
| Trip intake ("plan with AI") | Collects destination, dates, group, then hands off to the planner | `finalize_trip_intake` |
| Booking & ticketing agent (Mahavir's design, ported) | A separate chat (tag "booking"), same read/action/propose split, same allowlist and audit gateway | `get_trip`, `get_day`, `search_experiences`, `get_alternatives`, `get_policy`, `list_pending_changes`, `get_payments`, `get_tickets`, `report_running_late`, `report_weather`, `mood_checkin`, `request_callback`, `propose_booking`, `propose_balance_payment`, `propose_change_option` |

Not an agent: the **planner** (`planning/`) is a deterministic pipeline (geocode, retrieve, score with ML, cluster days,
sequence, record what was left out). The **payment gate** (`lib/payments.ts`) is deterministic code as well, on purpose.

### Human in the loop for money
The assistant can only *prepare* a payment. Its tool list is an allowlist with no approve, pay, refund or
read-payment-details tool. `propose_*` creates an approval card (exact quote, plan hash, 15 minute expiry). Approve and pay
are cookie-session routes the assistant's token cannot reach, admin only. If the plan or price changes after the quote,
the card goes stale and nothing is booked. Every tool call, allowed or blocked, is written to an audit trail. Secrets typed
into chat (card numbers with a Luhn check, CVV, UPI PIN, OTP, passwords, API keys) are removed before storage and before
the model sees them. Payments run in sandbox mode: no real money moves.

## Models (`agent-service/app/ml`, scikit-learn 1.9.1)

| Model | Type | Result |
|---|---|---|
| Satisfaction (per person, per place) | HistGradientBoosting regressor | test MAE 0.32 on a 1 to 5 scale, R² 0.78, on 95 held-out places (rating alone: MAE 0.63) |
| Crowd (busyness by hour) | gradient boosting | MAE 5 points, R² 0.88 |
| Mood (free text to labels) | TF-IDF + one-vs-rest logistic regression | F1 0.889 on 16 hand-written sentences |
| Mood, aligned LLM | NuGen alignment of llama-v3p2-3b-reasoning, deployed | **F1 0.706** on the same 16-sentence benchmark, worse than the local model's 0.889 |
| Gemini `gemini-flash-latest` | The booking agent, when `GEMINI_API_KEY` is set | Not configured in this environment yet; `app/intent.py`'s rules-based parser drives the same tools meanwhile, through the same gateway |

### Known weaknesses (say these before someone else does)
- The satisfaction and crowd models are trained on **synthetic travellers** generated from expert-written priors
  (`priors.py`), because there are no real ratings yet. They reproduce our assumptions. Real feedback is meant to
  retrain them.
- The mood model's F1 of 1.0 on its own held-out split is not meaningful: the split comes from the same generator.
  The honest figure is the 16-sentence natural test (0.889). It over-predicts "energetic", has no negation handling
  ("slept well" reads as tired), is English only, and has no context.
- **The NuGen-aligned model scores lower (0.706), not higher**, on the same 16 sentences. It missed "I'd love to
  understand the history of this place" entirely, and invented moods for "what time does the safari start?" (no mood
  expressed at all). It also answers the same question in at least four different JSON/text shapes across calls even
  at temperature 0 (`{"moods": [...]}`, a per-label `{"tired": false, ...}` dict, a bare `[...]` array, or plain
  comma-separated words) - `app/nugen/mood.py`'s parser now accepts all four, but that inconsistency itself is a
  reliability problem a 3B-parameter aligned model has that the dedicated scikit-learn classifier does not.

## Datasets
- **Kaggle, Top Indian Places to Visit** (325 attractions: ratings, review counts, fees, durations, best time, weekly
  offs, by Saket Kumar). Real places for model training and popularity/closure patterns. Credits in CREDITS.md.
- **Curated catalog**: 12 cities, 147 experiences, 48 hotels (`scripts/catalog.json`). Prices are realistic; vendors are fictional.
- **Synthetic**: 120,000 traveller-place rows, 60,000 crowd rows, 6,000 mood sentences.
- **Live services**: Geoapify (places), Open-Meteo (weather), OSRM (roads), OpenFreeMap (tiles), Wikimedia (photos).

## Disruption engine (`agent-service/app/planning/disruption.py`, ported from `adapt.py`)

Rain, running late, a stop becoming unavailable, or a smaller budget: the engine scores what is affected with the same
satisfaction model, prepares 2-3 recovery options (indoor swap / skip / keep; push the schedule / skip the next stop;
replace / drop; cut the cheapest-fit stops / swap to cheaper ones), and marks the best-scoring one recommended. Nothing
changes until the trip admin applies an option (`POST /api/disruptions/<id>/choose`), which goes through the same
payment gate as booking: free changes apply immediately, changes that cost more create an approval card, changes that
refund money are credited to the balance. Reported from the app (buttons on Plan) or by the agent (`report_weather`,
`report_running_late` tools).

## Weather digital twin (`agent-service/app/digital_twin.py`, ported)

Live weather (Open-Meteo, cached 10 min) for the 12 catalog destinations, plus a what-if simulator: rain/heat/wind/flood
sliders produce cascading risk scores for outdoor attractions, indoor demand, transport delay and hotel check-in, with
stated uncertainty margins. **This is a transparent rule model, not a trained model** — the coefficients are
hand-written, same as the original. The "social signals" shown alongside it are illustrative templates chosen by the
weather, not a live feed; every one is marked `illustrative: true` and the UI labels the section as such. "Apply
mitigation" hands off to the real disruption engine above. Page: `/ops/digital-twin`.

## Intent parser (`agent-service/app/intent.py`, ported from `assist.py`)

Regex-and-keyword classifier, no LLM: "we're running 30 min late" -> `{intent: "late", minutes: 30}`. Used by the
booking agent as its no-Gemini-key fallback, and to read free-text disruption reports.

## Where mood is used
`mood_check_in` (Ask agent): reads the mood (NuGen if deployed, else local), scores every stop of a day for every
traveller with and without it, and proposes swaps. It only proposes; the trip admin changes the plan.
