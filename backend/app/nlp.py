"""Intent parsing and vendor-listing extraction.

Uses the Anthropic Messages API when ANTHROPIC_API_KEY and GAPFILL_LLM_MODEL are set; otherwise (or on any error)
falls back to the rules-based parsers below so the flow never breaks.
"""
import json
import os
import re

import httpx

from .seed_data import LOCATIONS

LLM_MODEL = os.environ.get("GAPFILL_LLM_MODEL")  # model id, e.g. a small fast Anthropic model

CATEGORY_KEYWORDS = {
    "food": ["food", "foodie", "eat", "eating", "hungry", "snack", "chaat", "thali", "lassi", "kachori", "tasting", "cook", "cooking", "dinner", "lunch", "street food", "chai"],
    "culture": ["culture", "heritage", "history", "museum", "palace", "fort", "puppet", "folk", "art", "temple", "tradition"],
    "adventure": ["adventure", "adventurous", "thrill", "trek", "hike", "hiking", "zipline", "cycle", "cycling", "active", "outdoorsy", "adrenaline"],
    "workshop": ["workshop", "class", "learn", "make", "hands-on", "craft", "print", "pottery", "diy"],
    "nightlife": ["nightlife", "night", "bar", "music", "rooftop", "party", "live music", "drinks"],
    "shopping": ["shop", "shopping", "bazaar", "market", "gems", "jewellery", "jewelry"],
    "views": ["view", "views", "sunset", "sunrise", "photo", "photography", "scenic"],
}
MOOD_TAGS = {
    "chill": ["culture", "food"], "relax": ["culture", "food"], "relaxed": ["culture", "food"], "lazy": ["food"],
    "romantic": ["views", "music"], "kids": ["family"], "bored": ["adventure", "workshop"],
}
ACCESS_KEYWORDS = {
    "step_free": ["wheelchair", "step-free", "step free", "ramp", "ground floor", "no stairs", "lift", "elevator"],
    "seating_available": ["seat", "seating", "chairs", "sit down", "benches", "sitting"],
    "restroom_onsite": ["restroom", "toilet", "washroom", "bathroom", "loo"],
    "sensory_friendly": ["quiet", "calm", "sensory", "not crowded", "peaceful", "low noise"],
}
GROUP_KEYWORDS = {
    "solo": ["solo", "alone", "single", "individual", "anyone", "everyone", "all"],
    "couple": ["couple", "couples", "pair", "two people", "date", "anyone", "everyone", "all"],
    "family": ["family", "families", "kids", "children", "child", "anyone", "everyone", "all"],
    "large_group": ["group", "groups", "large group", "friends", "team", "corporate", "anyone", "everyone", "all"],
}
AREA_ALIASES = {
    "johari": "johari_bazaar", "bapu bazaar": "johari_bazaar", "hawa mahal": "hawa_mahal", "city palace": "city_palace",
    "amber": "amber_fort", "amer": "amber_fort", "jal mahal": "jal_mahal", "nahargarh": "nahargarh",
    "mi road": "mi_road", "m.i. road": "mi_road", "albert": "albert_hall", "ram niwas": "albert_hall",
    "c-scheme": "c_scheme", "c scheme": "c_scheme", "sanganer": "sanganer", "bani park": "hotel",
}


def _has(text: str, word: str) -> bool:
    return re.search(r"(?<![a-z])" + re.escape(word) + r"(?![a-z])", text) is not None


# ---------------------------------------------------------------- LLM (optional)
async def _llm_json(system: str, user: str) -> dict | None:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key or not LLM_MODEL:
        return None
    base = os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            r = await client.post(
                f"{base}/v1/messages",
                headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={"model": LLM_MODEL, "max_tokens": 800, "system": system,
                      "messages": [{"role": "user", "content": user}]},
            )
            r.raise_for_status()
            text = "".join(b.get("text", "") for b in r.json().get("content", []))
            m = re.search(r"\{.*\}", text, re.S)
            return json.loads(m.group(0)) if m else None
    except Exception:
        return None


# ---------------------------------------------------------------- traveler intent
def parse_intent_rules(text: str) -> dict:
    t = (text or "").lower()
    tags = [cat for cat, words in CATEGORY_KEYWORDS.items() if any(_has(t, w) for w in words)]
    for mood, mt in MOOD_TAGS.items():
        if _has(t, mood):
            tags += [x for x in mt if x not in tags]
    out: dict = {"tags": tags}
    m = re.search(r"(?:under|below|less than|max|upto|up to|within)\s*(?:₹|rs\.?|inr)?\s*(\d{2,5})", t)
    if m:
        out["max_price"] = float(m.group(1))
    elif any(_has(t, w) for w in ["cheap", "budget", "affordable", "free"]):
        out["max_price"] = 500.0
    m = re.search(r"(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b", t)
    m2 = re.search(r"(\d+)\s*(minutes?|mins?)\b", t)
    if m2:
        out["max_duration"] = int(m2.group(1))
    elif m and any(_has(t, w) for w in ["under", "less than", "max", "within", "only", "quick", "short"]):
        out["max_duration"] = int(float(m.group(1)) * 60)
    elif any(_has(t, w) for w in ["quick", "short", "fast"]):
        out["max_duration"] = 60
    if any(_has(t, w) for w in ["indoor", "indoors", "inside", "rain", "raining", "ac", "air-conditioned", "too hot", "hot"]):
        out["indoor_only"] = True
    return out


async def parse_intent(text: str) -> tuple[dict, str]:
    llm = await _llm_json(
        "You convert a traveler's free-text mood into JSON filters. Reply with ONLY a JSON object with keys: "
        "tags (array from: food, culture, adventure, workshop, nightlife, shopping, views), max_price (number INR or null), "
        "max_duration (minutes or null), indoor_only (boolean).",
        text,
    )
    if llm and isinstance(llm.get("tags"), list):
        clean = {"tags": [x for x in llm["tags"] if x in CATEGORY_KEYWORDS]}
        for k in ("max_price", "max_duration"):
            if llm.get(k):
                clean[k] = float(llm[k]) if k == "max_price" else int(llm[k])
        if llm.get("indoor_only"):
            clean["indoor_only"] = True
        return clean, "llm"
    return parse_intent_rules(text), "rules"


# ---------------------------------------------------------------- vendor listing extraction
def _minutes_from(text: str) -> int | None:
    t = text.lower()
    m = re.search(r"(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b", t)
    mins = re.search(r"(\d+)\s*(minutes?|mins?)\b", t)
    total = 0
    if m:
        total += float(m.group(1)) * 60
    if mins:
        total += int(mins.group(1))
    if "half an hour" in t or "half hour" in t:
        total = total or 30
    return int(total) if total else None


def _clock(h: str, m: str | None, ap: str | None) -> str:
    hh, mm = int(h), int(m or 0)
    if ap:
        ap = ap.lower()
        if ap.startswith("p") and hh < 12:
            hh += 12
        if ap.startswith("a") and hh == 12:
            hh = 0
    return f"{hh:02d}:{mm:02d}"


def extract_listing_rules(answers: list[str]) -> dict:
    full = " \n".join(a or "" for a in answers)
    t = full.lower()
    first = (answers[0] if answers else "") or ""

    # business name + title from the first answer: "We're X and we run/offer Y"
    name, title = None, None
    m = re.search(r"(?i:we are|we're|i am|i'm|this is|called)\s+([A-Z][\w'&\- ]{2,40}?)(?:[,.!]| and | - |$)", first)
    if m:
        name = m.group(1).strip()
    m = re.search(r"(?:we (?:run|offer|do|host)|i (?:run|offer|do|host)|offer(?:ing)?|run(?:ning)?)\s+(?:a |an |the )?([^.!?\n]{4,80})", first, re.I)
    if m:
        title = m.group(1).strip().rstrip(",")
    title = title or (first.split(".")[0][:70] if first else "New local experience")
    title = title[0].upper() + title[1:] if title else title

    tags = [cat for cat, words in CATEGORY_KEYWORDS.items() if any(_has(t, w) for w in words)] or ["local"]

    price = None
    m = re.search(r"(?:₹|rs\.?|inr)\s*(\d[\d,]*)", t) or re.search(r"(\d[\d,]*)\s*(?:rupees|rs|inr|/-|per person|each|pp)", t)
    if m:
        price = float(m.group(1).replace(",", ""))
    duration = _minutes_from(full)

    cap = None
    m = re.search(r"(\d+)\s*(?:people|guests|spots|seats|slots|persons|pax|participants)", t)
    if m:
        cap = int(m.group(1))

    hours = None
    m = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-|–|till|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?", t)
    if m:
        ap2 = m.group(6)
        ap1 = m.group(3) or (ap2 if ap2 and int(m.group(1)) <= int(m.group(4)) else None)
        hours = {"open": _clock(m.group(1), m.group(2), ap1), "close": _clock(m.group(4), m.group(5), ap2)}

    io = "indoor"
    has_out = any(_has(t, w) for w in ["outdoor", "outdoors", "outside", "open air", "open-air", "rooftop", "walk", "trek"])
    has_in = any(_has(t, w) for w in ["indoor", "indoors", "inside", "studio", "hall", "kitchen"])
    if has_out and has_in:
        io = "mixed"
    elif has_out:
        io = "outdoor"

    access = {f: any(k in t for k in kws) for f, kws in ACCESS_KEYWORDS.items()}
    negations = re.findall(r"(?:no|not|without)\s+([a-z\- ]{3,20})", t)
    for neg in negations:
        for f, kws in ACCESS_KEYWORDS.items():
            if any(k in neg for k in kws):
                access[f] = False

    groups = [g for g, kws in GROUP_KEYWORDS.items() if any(_has(t, k) for k in kws)] or ["solo", "couple", "family"]

    loc_key = None
    for alias, key in AREA_ALIASES.items():
        if alias in t:
            loc_key = key
            break
    missing = [k for k, v in {"price": price, "duration_min": duration, "opening_hours": hours, "location": loc_key}.items() if v is None]
    loc_key = loc_key or "mi_road"
    name_, lat, lng = LOCATIONS[loc_key]
    return {
        "vendor_name": name, "title": title, "description": first.strip()[:300],
        "category_tags": tags, "price": price or 500.0, "duration_min": duration or 60,
        "location": {"key": loc_key, "name": name_, "lat": lat, "lng": lng},
        "accessibility_attributes": access, "group_suitability": groups,
        "opening_hours": hours or {"open": "10:00", "close": "18:00"}, "indoor_outdoor": io,
        "capacity_left": cap or 10, "needs_review": missing,
    }


async def extract_listing(answers: list[str], questions: list[str]) -> tuple[dict, str]:
    base = extract_listing_rules(answers)
    transcript = "\n".join(f"Q: {q}\nA: {a}" for q, a in zip(questions, answers))
    llm = await _llm_json(
        "Extract a tour/experience listing from a vendor chat. Reply ONLY JSON with keys: vendor_name, title (short, catchy), "
        "description (1-2 sentences), category_tags (subset of food, culture, adventure, workshop, nightlife, shopping, views), "
        "price (INR per person number), duration_min (int), area (one of: " + ", ".join(LOCATIONS) + "), "
        "accessibility_attributes {step_free, seating_available, restroom_onsite, sensory_friendly: booleans}, "
        "group_suitability (subset of solo, couple, family, large_group), opening_hours {open, close as HH:MM 24h}, "
        "indoor_outdoor (indoor/outdoor/mixed), capacity_left (int).",
        transcript,
    )
    if not llm:
        return base, "rules"
    try:
        merged = dict(base)
        for k in ["vendor_name", "title", "description", "category_tags", "price", "duration_min",
                  "accessibility_attributes", "group_suitability", "opening_hours", "indoor_outdoor", "capacity_left"]:
            if llm.get(k) not in (None, "", []):
                merged[k] = llm[k]
        if llm.get("area") in LOCATIONS:
            n, lat, lng = LOCATIONS[llm["area"]]
            merged["location"] = {"key": llm["area"], "name": n, "lat": lat, "lng": lng}
        merged["price"], merged["duration_min"], merged["capacity_left"] = float(merged["price"]), int(merged["duration_min"]), int(merged["capacity_left"])
        merged["needs_review"] = []
        return merged, "llm"
    except Exception:
        return base, "rules"
