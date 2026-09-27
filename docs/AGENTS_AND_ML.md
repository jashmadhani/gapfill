# Agents, models and data

A plain account of what runs where, for anyone who has to explain it.

## Agents (agent-service, Python + LangGraph, Groq `openai/gpt-oss-120b`)

| Agent | Job | Tools |
|---|---|---|
| Trip assistant (Ask tab) | Answers from the traveller's real data and acts inside guard rails | `get_my_profile`, `list_my_trips`, `get_trip_details`, `summarize_past_trips`, `search_experiences`, `remember_fact`, `navigate_app`, `mood_check_in`, `get_payments`, `propose_booking`, `propose_balance_payment` |
| Trip intake ("plan with AI") | Collects destination, dates, group, then hands off to the planner | `finalize_trip_intake` |

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
| Mood, aligned LLM (optional) | NuGen alignment of a base model | not deployed until `python -m app.nugen.align` is run; falls back to the model above |

### Known weaknesses (say these before someone else does)
- The satisfaction and crowd models are trained on **synthetic travellers** generated from expert-written priors
  (`priors.py`), because there are no real ratings yet. They reproduce our assumptions. Real feedback is meant to
  retrain them.
- The mood model's F1 of 1.0 on its own held-out split is not meaningful: the split comes from the same generator.
  The honest figure is the 16-sentence natural test (0.889). It over-predicts "energetic", has no negation handling
  ("slept well" reads as tired), is English only, and has no context.

## Datasets
- **Kaggle, Top Indian Places to Visit** (325 attractions: ratings, review counts, fees, durations, best time, weekly
  offs, by Saket Kumar). Real places for model training and popularity/closure patterns. Credits in CREDITS.md.
- **Curated catalog**: 12 cities, 147 experiences, 48 hotels (`scripts/catalog.json`). Prices are realistic; vendors are fictional.
- **Synthetic**: 120,000 traveller-place rows, 60,000 crowd rows, 6,000 mood sentences.
- **Live services**: Geoapify (places), Open-Meteo (weather), OSRM (roads), OpenFreeMap (tiles), Wikimedia (photos).

## Where mood is used
`mood_check_in` (Ask agent): reads the mood (NuGen if deployed, else local), scores every stop of a day for every
traveller with and without it, and proposes swaps. It only proposes; the trip admin changes the plan.
