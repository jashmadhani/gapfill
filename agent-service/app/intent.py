"""Intent parser: turns a traveller's message into a structured intent, with no LLM.

Ported from the original assist.py. Used (1) by the booking agent when no GEMINI_API_KEY is set, so the same tools still
run through the same gateway, and (2) to read "we're running 30 min late" / "it's pouring" into disruption triggers.
The LLM agents do their own intent reading; this is the deterministic path and the fallback.
"""
import re

INTENTS = ["help", "mood", "schedule", "cost", "late", "rain", "weather", "add", "remove", "hotel_down", "hotel_up", "lighter",
           "coordinator", "book", "pay_balance", "tickets", "changes", "choose_option"]

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


def parse(text: str) -> dict:
    t = text.lower()
    day = int(m.group(1)) if (m := re.search(r"\bday\s*(\d+)", t)) else None
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
    option = m.group(1).upper() if (m := re.search(r"\boption\s*([abc])\b", t)) else None

    def has(*ws):
        return any(re.search(r"\b" + re.escape(w) + r"\b", t) for w in ws)

    if option or has("go with", "choose", "pick the"):
        return {"intent": "choose_option", "option": option, "day": day}
    if has("ticket", "tickets", "voucher", "vouchers", "e-ticket"):
        return {"intent": "tickets"}
    if has("balance", "remaining", "rest of the payment") and has("pay"):
        return {"intent": "pay_balance"}
    if has("book", "confirm the trip", "reserve") and has("trip", "tour", "this", "it", "everything", "deposit", "full"):
        return {"intent": "book", "pay": "full" if has("full", "whole", "entire") else "deposit"}
    if has("pending", "options", "what changed", "changes"):
        return {"intent": "changes"}
    if has("tired", "exhausted", "wiped", "knackered", "cranky", "restless", "bored", "energetic", "pumped", "starving", "sleepy") \
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
    if has("add", "want", "suggest", "something", "include", "try") or (any(has(*ws) for ws in KEYWORDS.values()) and not has("what", "show")):
        return {"intent": "add", "keyword": kw or t, "day": day, "tomorrow": has("tomorrow")}
    if has("cost", "price", "paid", "pay", "budget", "owe", "spent", "how much"):
        return {"intent": "cost"}
    if has("today", "next", "now", "tomorrow", "schedule", "plan", "itinerary", "show") or day:
        return {"intent": "schedule", "day": day, "tomorrow": has("tomorrow")}
    return {"intent": "help"}
