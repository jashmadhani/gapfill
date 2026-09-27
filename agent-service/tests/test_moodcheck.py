from datetime import date

from app.planning.catalog import to_place
from app.planning.fit import normalise_members
from app.planning.moodcheck import analyse

MEMBERS = normalise_members([{"name": "Arav", "age": 38}, {"name": "Mira", "age": 9}], "family", ["heritage"])


def poi(pid, name, category, intensity, stairs, walk, dur, rating=4.5, indoor="outdoor", shade=0.3):
    p = to_place({
        "poiId": f"key_{pid}", "id": pid, "name": name, "lat": 26.9, "lng": 75.8, "price": 500, "rating": rating, "ratingCount": 500,
        "tags": ["heritage"], "category": category, "durationMin": dur, "indoorOutdoor": indoor, "stepFree": True,
        "attrs": {"category": category, "intensity": intensity, "stairs": stairs, "walkKm": walk, "seating": 0.4, "shade": shade,
                  "popularity": 0.5, "minAge": 0, "kidFriendly": True, "bestTime": "all", "openMin": 480},
    })
    return p | {"poiId": pid}


def test_tired_group_is_offered_a_calmer_swap_for_a_demanding_stop():
    hill = poi("a", "Hill fort climb", "heritage", 3, 0.9, 3.0, 150)
    museum = poi("b", "Cool museum", "museum", 1, 0.1, 0.5, 120, indoor="indoor")
    pool = {"a": hill, "b": museum}
    day = [{"itemId": "i1", "type": "activity", "title": "Hill fort climb", "startTime": "2026-11-10T13:00:00.000Z", "durationMin": 150, "poiId": "a", "price": 500}]
    out = analyse(MEMBERS, day, pool, on=date(2026, 11, 10), theme_tags=["heritage"], moods=["tired", "hot"])
    stop = out["stops"][0]
    assert stop["fitWithMood"] < stop["fitBefore"]
    assert out["proposals"] and out["proposals"][0]["with"] == "Cool museum"
    assert out["proposals"][0]["fitWith"] - out["proposals"][0]["fitNow"] >= 10


def test_no_mood_effect_means_no_proposals():
    museum = poi("b", "Cool museum", "museum", 1, 0.1, 0.5, 120, indoor="indoor")
    day = [{"itemId": "i1", "type": "activity", "title": "Cool museum", "startTime": "2026-11-10T10:00:00.000Z", "durationMin": 120, "poiId": "b", "price": 500}]
    out = analyse(MEMBERS, day, {"b": museum}, on=date(2026, 11, 10), theme_tags=["heritage"], moods=[])
    assert out["proposals"] == []
