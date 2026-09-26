"""In-trip assistant. Understands a handful of intents (schedule, costs, add/remove/swap, running late, rain,
lighter day, coordinator) and acts on the tour directly.

Uses the Anthropic Messages API for intent parsing when ANTHROPIC_API_KEY is set (model: TOURCRAFT_LLM_MODEL);
otherwise, or on any error, falls back to the rules below so the flow never breaks.
"""
import json
import os
import re

import httpx

from . import planner as P
from .adapt import run_trigger
from .customize import CustomizeError, add, remove, swap
from .models import Coordinator
from .services import add_task, ctx_for, current_day, get_state, is_past, item_dict, load_items, payments_summary

LLM_MODEL = os.environ.get("TOURCRAFT_LLM_MODEL", "claude-sonnet-5")
INTENTS = ["help", "mood", "schedule", "cost", "late", "rain", "weather", "add", "remove", "hotel_down", "hotel_up", "lighter", "coordinator"]

KEYWORDS = {
    "food": ["food", "foodie", "eat", "hungry", "cook", "cooking", "dinner", "lunch", "street food", "thali", "snack"],
    "heritage": ["fort", "palace", "heritage", "history", "museum", "monument", "tomb"],
    "culture": ["culture", "dance", "folk", "music", "show", "puppet"],
    "adventure": ["adventure", "zipline", "thrill", "safari", "jeep", "camel", "balloon", "active"],
    "wildlife": ["tiger", "wildlife", "animals", "safari"],
    "shopping": ["shop", "shopping", "bazaar", "market", "souvenir"],
    "relaxation": ["relax", "spa", "massage", "chill", "boat", "slow"],
    "photography": ["photo", "photography", "sunset", "sunrise", "view", "views"],
    "workshop": ["workshop", "class", "learn", "craft", "painting", "print"],
    "spiritual": ["temple", "spiritual", "ghat", "prayer"],
    "nightlife": ["night", "nightlife", "evening"],
}
HELP = ("I can help with your tour. Try:\n• “What's next today?” / “Show day 3”\n• “Add a cooking class” / “Something foodie tomorrow”\n"
        "• “Skip the zipline”\n• “Make day 4 lighter”\n• “Cheaper hotel in Udaipur”\n• “I'm running 30 min late” / “It's raining”\n"
        "• “How much have I paid?”\n• “Call my coordinator”")


async def _llm(text: str) -> dict | None:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return None
    system = ("Classify a traveler's message to their tour assistant. Reply with JSON only: "
              '{"intent": one of ' + json.dumps(INTENTS) + ', "day": int|null, "keyword": string|null, "minutes": int|null}. '
              "keyword = the activity, interest or place the traveler mentions (for add/remove), else null.")
    try:
        async with httpx.AsyncClient(timeout=12) as c:
            r = await c.post(os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com").rstrip("/") + "/v1/messages",
                             headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                             json={"model": LLM_MODEL, "max_tokens": 200, "system": system, "messages": [{"role": "user", "content": text}]})
            r.raise_for_status()
            out = "".join(b.get("text", "") for b in r.json().get("content", []))
            m = re.search(r"\{.*\}", out, re.S)
            data = json.loads(m.group(0)) if m else None
            return data if data and data.get("intent") in INTENTS else None
    except Exception:
        return None


def parse_rules(text: str) -> dict:
    t = text.lower()
    day = None
    if m := re.search(r"\bday\s*(\d+)", t):
        day = int(m.group(1))
    minutes = None
    if m := re.search(r"(\d+)\s*(min|mins|minutes|m\b)", t):
        minutes = int(m.group(1))
    elif m := re.search(r"(\d+)\s*(hour|hr)", t):
        minutes = int(m.group(1)) * 60
    elif "hour" in t:
        minutes = 60
    kw = None
    if m := re.search(r"\b(?:add|book|want|try|do|skip|remove|cancel|drop|include)\b\s+(?:a|an|the|some|my)?\s*(.+?)(?:\s+(?:on|for|tomorrow|today)\b.*)?[.?!]*$", t):
        kw = m.group(1).strip()
    def has(*ws):
        return any(re.search(r"\b" + re.escape(w) + r"\b", t) for w in ws)
    if has("tired", "exhausted", "wiped", "knackered", "cranky", "restless", "bored", "energetic", "pumped", "starving", "hungry", "sleepy") \
            or (has("kids", "children") and has("fun", "bored", "restless", "cranky")):
        return {"intent": "mood", "day": day}
    if has("late", "delayed", "stuck", "traffic"):
        return {"intent": "late", "minutes": minutes or 45, "day": day}
    if has("raining", "rain", "storm", "pouring") and not has("forecast", "will it"):
        return {"intent": "rain", "day": day}
    if has("weather", "forecast"):
        return {"intent": "weather", "day": day}
    if has("coordinator", "call", "emergency", "human", "agent", "help me"):
        return {"intent": "coordinator"}
    if has("cheaper", "downgrade") and has("hotel", "stay", "room"):
        return {"intent": "hotel_down", "day": day, "keyword": kw}
    if has("upgrade", "nicer", "better", "luxury") and has("hotel", "stay", "room"):
        return {"intent": "hotel_up", "day": day, "keyword": kw}
    if has("lighter", "slower", "less packed", "rest day"):
        return {"intent": "lighter", "day": day}
    if has("skip", "remove", "cancel", "drop"):
        return {"intent": "remove", "keyword": kw, "day": day}
    if has("add", "book", "want", "suggest", "something", "include", "try") or any(has(*ws) for ws in KEYWORDS.values()) and not has("what", "show"):
        return {"intent": "add", "keyword": kw or t, "day": day, "tomorrow": has("tomorrow")}
    if has("cost", "price", "paid", "pay", "balance", "budget", "owe", "spent", "how much"):
        return {"intent": "cost"}
    if has("today", "next", "now", "tomorrow", "schedule", "plan", "itinerary", "show") or day:
        return {"intent": "schedule", "day": day, "tomorrow": has("tomorrow")}
    return {"intent": "help"}


def match_offerings(keyword: str, dest: str, ctx) -> list:
    kw = (keyword or "").lower()
    tags = {tag for tag, ws in KEYWORDS.items() if tag in kw or any(w in kw for w in ws)}
    words = [w for w in re.findall(r"[a-z]+", kw) if len(w) > 3]
    scored = []
    for o in P.acts_in(dest):
        s = 3 * len(set(o["tags"]) & tags) + 4 * sum(1 for w in words if w in o["title"].lower())
        if s:
            scored.append((s + P.act_score(o, ctx) / 10, o))
    return [o for _, o in sorted(scored, key=lambda x: -x[0])]


def fmt_day(tour, items, d, st) -> str:
    rows = sorted([i for i in items if i["day"] == d and P.live(i) and i["kind"] in ("activity", "transport")], key=lambda i: i["start_min"])
    if not rows:
        return f"Day {d} is free. Want me to add something?"
    lines = [f"{'✓ ' if is_past(tour, i, st) else '• '}{P.label(i['start_min'])} {i['title']}" for i in rows]
    return "\n".join(lines)


async def handle(db, tour, text: str) -> tuple[str, dict]:
    st = await get_state(db)
    ctx = ctx_for(tour, st)
    rows = await load_items(db, tour.id)
    items = [item_dict(r) for r in rows]
    parsed = await _llm(text) or parse_rules(text)
    intent = parsed.get("intent", "help")
    cur = current_day(tour, st)
    target = parsed.get("day") or ((cur or 0) + 1 if parsed.get("tomorrow") else cur) or 1
    target = max(1, min(tour.days, target))
    data = {"intent": intent}

    if intent == "schedule":
        dest = P.W["dests"][P.dest_for_day(ctx, target)]["name"]
        return f"Day {target} · {dest}\n" + fmt_day(tour, items, target, st), data
    if intent == "cost":
        pr = P.price(items, ctx)
        pay = await payments_summary(db, tour, pr["total"])
        return (f"Your tour is {P.fmt_inr(pr['total'])} ({P.fmt_inr(pr['per_person'])} per person). "
                f"Paid {P.fmt_inr(pay['net_paid'])}, balance {P.fmt_inr(max(0, pay['balance']))}."
                + (f" Budget {P.fmt_inr(pr['budget'])}, {'within budget ✓' if pr['within_budget'] else P.fmt_inr(pr['over_by']) + ' over'}." if pr["budget"] else "")), data
    if intent in ("late", "rain"):
        body = {"trigger_type": "running_late", "tour_id": tour.id, "minutes": parsed.get("minutes") or 45, "source": "traveler"} if intent == "late" else \
               {"trigger_type": "weather", "dest": P.dest_for_day(ctx, target), "date": str(tour.start_date.fromordinal(tour.start_date.toordinal() + target - 1)), "source": "traveler"}
        evs, note = await run_trigger(db, body, tour.id)
        data["events"] = [e.id for e in evs if e.tour_id == tour.id]
        if data["events"]:
            return "I've worked out what's affected and prepared options. Compare them on the card below and pick one.", data
        return note or "Nothing in your plan is affected.", data
    if intent == "mood":
        from .ml import infer as ML
        moods = [m["mood"] for m in ML.parse_mood(text)]
        evs, note = await run_trigger(db, {"trigger_type": "mood_change", "tour_id": tour.id, "moods": moods, "text": text, "source": "traveler"}, tour.id)
        data["events"] = [e.id for e in evs if e.tour_id == tour.id]
        data["moods"] = moods
        if data["events"]:
            return f"Got it: reading that as {', '.join(moods) or 'neutral'}. I re-scored the rest of the day for everyone; compare the options on the card.", data
        return note or "Noted.", data
    if intent == "weather":
        rainy = [f"day {d}" for d in range(1, tour.days + 1) if P.rain_on(ctx, P.dest_for_day(ctx, d), d)]
        return ("Rain is forecast on " + ", ".join(rainy) + ". I'll flag outdoor plans." if rainy else "Clear skies forecast for your whole tour ☀️"), data
    if intent == "coordinator":
        c = await db.get(Coordinator, tour.coordinator_id) if tour.coordinator_id else None
        await add_task(db, "callback", f"{tour.code}: traveler asked for a call, “{text[:80]}”", tour.id, None, tour.coordinator_id)
        return (f"I've asked {c.name} to call you back. You can also reach them directly on {c.phone}." if c
                else "I've asked the operations team to call you back shortly."), data
    if intent == "add":
        dest = P.dest_for_day(ctx, target)
        cands = [o for o in match_offerings(parsed.get("keyword") or text, dest, ctx) if not any(i["offering_id"] == o["id"] and P.live(i) for i in items)]
        if not cands:
            return f"I couldn't find a matching experience in {P.W['dests'][dest]['name']}. Try Discover for ideas.", data
        for o in cands[:4]:
            try:
                r = await add(db, tour, o["id"], target)
                data["added"] = r
                words = [w for w in re.findall(r"[a-z]+", (parsed.get("keyword") or "").lower()) if len(w) > 3]
                exact = not words or any(w in o["title"].lower() for w in words)
                return ((f"There's no exact match in {P.W['dests'][dest]['name']}, so I picked the closest. " if not exact else "")
                        + f"Added {o['title']} on day {r['day']} at {r['start_label']}, {P.fmt_inr(o['price'])} per person, {o['rating']:.1f}★."
                        + (f" Booking {r['booking_ref']} sent to the vendor for confirmation." if r.get("booking_ref") else "")), data
            except CustomizeError:
                continue
        return f"{cands[0]['title']} is a great match but day {target} is full. Want me to make room by skipping something?", data
    if intent == "remove":
        kw = (parsed.get("keyword") or "").lower()
        words = [w for w in re.findall(r"[a-z]+", kw) if len(w) > 3]
        upcoming_acts = [i for i in items if P.live(i) and i["kind"] == "activity" and not is_past(tour, i, st)]
        by_title = sorted(upcoming_acts, key=lambda i: -sum(1 for w in words if w in i["title"].lower()))
        hit = by_title[0] if by_title and any(w in by_title[0]["title"].lower() for w in words) else             next((i for i in upcoming_acts if any(w in " ".join((P.off(i["offering_id"]) or {}).get("tags", [])) for w in words)), None)
        if not hit:
            return "I couldn't find that in your upcoming plan. Which one should I skip?", data
        r = await remove(db, tour, hit["id"])
        return f"Removed {hit['title']} (day {hit['day']})." + (f" A cancellation fee of {P.fmt_inr(r['fee'])} applies under the vendor's policy." if r["fee"] else " No cancellation fee."), data
    if intent in ("hotel_down", "hotel_up"):
        stays = [i for i in items if P.live(i) and i["kind"] == "hotel" and not is_past(tour, i, st)]
        kw = (parsed.get("keyword") or text).lower()
        h = next((i for i in stays if P.W["dests"][i["dest_key"]]["name"].lower() in kw), None) or \
            next((i for i in stays if i["day"] <= target < i["day"] + i["nights"]), stays[0] if stays else None)
        if not h:
            return "There are no upcoming hotel stays to change.", data
        cur_t = P.TIERS.index(h["meta"].get("tier", "standard"))
        want = cur_t + (1 if intent == "hotel_up" else -1)
        alt = next((a for a in P.hotel_alternatives(h, ctx) if P.TIERS.index(a["offering"]["tier"]) == want), None)
        if not alt:
            return f"{h['title']} is already the {'top' if intent == 'hotel_up' else 'most affordable'} option in {P.W['dests'][h['dest_key']]['name']}.", data
        r = await swap(db, tour, h["id"], alt["offering"]["id"])
        return (f"Switched {P.W['dests'][h['dest_key']]['name']} to {r['title']} ({alt['offering']['tier']}), "
                f"{'+' if alt['delta'] > 0 else ''}{P.fmt_inr(P.gross(alt['delta']))} incl. taxes." + (f" Fee {P.fmt_inr(r['fee'])}." if r["fee"] else "")), data
    if intent == "lighter":
        acts = [i for i in items if P.live(i) and i["kind"] == "activity" and i["day"] == target and not is_past(tour, i, st)]
        if len(acts) <= 1:
            return f"Day {target} is already light ({len(acts)} activity).", data
        low = min(acts, key=lambda i: P.act_score(P.off(i["offering_id"]), ctx))
        r = await remove(db, tour, low["id"])
        return f"Made day {target} lighter: removed {low['title']}." + (f" Fee {P.fmt_inr(r['fee'])}." if r["fee"] else ""), data
    return HELP, data
