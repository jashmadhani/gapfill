from datetime import date

from app.planning.catalog import to_place
from app.planning.disruption import Day, analyse_budget, analyse_late, analyse_unavailable, analyse_weather, score_and_mark
from app.planning.fit import normalise_members

MEMBERS = normalise_members([{"name": "Arav", "age": 38}, {"name": "Mira", "age": 9}], "family", ["heritage"])


def poi(pid, name, io="outdoor", dur=120, price=500, open_min=480, window=720, category="heritage", intensity=2, stairs=0.3):
    p = to_place({"poiId": f"k_{pid}", "id": pid, "name": name, "lat": 26.9, "lng": 75.8, "price": price, "rating": 4.5, "ratingCount": 400,
                  "tags": ["heritage"], "category": category, "durationMin": dur, "indoorOutdoor": io, "stepFree": True,
                  "attrs": {"category": category, "intensity": intensity, "stairs": stairs, "walkKm": 1, "seating": 0.4, "shade": 0.3, "popularity": 0.5,
                            "minAge": 0, "kidFriendly": True, "bestTime": "all", "openMin": open_min, "openWindowMin": window}})
    return p | {"poiId": pid}


def card(item, pid, title, start, price=500, dur=120):
    return {"itemId": item, "type": "activity", "title": title, "startTime": f"2026-11-10T{start}:00.000Z", "durationMin": dur, "poiId": pid, "price": price}


POOL = {"fort": poi("fort", "Hill fort"), "garden": poi("garden", "Garden walk", dur=90), "museum": poi("museum", "City museum", io="indoor", category="museum"),
        "crafts": poi("crafts", "Crafts studio", io="indoor", category="workshop", price=300), "late": poi("late", "Early-closing temple", window=480)}
CARDS = [card("i1", "fort", "Hill fort", "09:00"), card("i2", "garden", "Garden walk", "13:00", dur=90), card("i3", "late", "Early-closing temple", "15:00")]


def day(rain=False):
    return Day(MEMBERS, CARDS, POOL, date(2026, 11, 10), ["heritage"], rain=rain)


def test_rain_offers_indoor_swaps_and_marks_one_option_recommended():
    ev = analyse_weather(day(rain=True))
    assert ev["kind"] == "weather" and "Hill fort" in ev["impact"]
    swap = ev["options"][0]
    assert swap["label"].startswith("Swap") and all(c["op"] == "swap" for c in swap["changes"])
    assert {c["title"] for c in swap["changes"]} <= {"City museum", "Crafts studio"}
    assert sum(o["recommended"] for o in ev["options"]) == 1


def test_running_late_drops_what_would_close_before_the_new_time():
    ev = analyse_late(day(), 90)
    push = ev["options"][0]
    ops = {c["from"]: c["op"] for c in push["changes"]}
    assert ops["Hill fort"] == "shift" and ops["Early-closing temple"] == "remove"  # opens 08:00, closes 16:00; 15:00+90 min runs past
    assert ev["options"][1]["changes"] == [{"op": "remove", "itemId": "i1", "from": "Hill fort", "reason": "Skipped to make up time"}]


def test_unavailable_stop_gets_a_replacement_or_can_be_dropped():
    ev = analyse_unavailable(day(), "i2")
    assert ev["options"][0]["changes"][0]["op"] == "swap" and ev["options"][-1]["changes"][0]["op"] == "remove"


def test_budget_cut_brings_the_plan_within_budget():
    ev = analyse_budget([day()], 1500, 900)
    assert -ev["options"][0]["costPerPerson"] >= 600


def test_scoring_prefers_fit_over_cost_and_time():
    opts = score_and_mark([{"key": "A", "fit": 80, "costPerPerson": 200, "lostMin": 0}, {"key": "B", "fit": 50, "costPerPerson": -500, "lostMin": 120}])
    assert opts[0]["recommended"] and not opts[1]["recommended"]
