from datetime import date

from app.planning.catalog import score_catalog_place, to_place
from app.planning.fit import evaluate, normalise_members, summarise

FORT = {
    "poiId": "fort", "id": "1", "name": "Hill fort walk", "lat": 26.98, "lng": 75.85, "price": 900, "rating": 4.7, "ratingCount": 800,
    "tags": ["heritage"], "category": "heritage", "durationMin": 150, "indoorOutdoor": "outdoor", "stepFree": False,
    "attrs": {"category": "heritage", "intensity": 3, "stairs": 0.85, "walkKm": 2.5, "seating": 0.2, "shade": 0.3, "popularity": 0.9,
              "minAge": 0, "kidFriendly": True, "bestTime": "morning", "openMin": 480},
}
FAMILY = [{"name": "Arav", "age": 38}, {"name": "Kabir", "age": 8}, {"name": "Nani", "age": 72, "stepFree": True}]


def test_defaults_follow_group_type():
    assert [m["name"] for m in normalise_members(None, "couple", [])] == ["You", "Partner"]
    assert len(normalise_members(None, "family", [])) == 3
    named = normalise_members([{"name": "Arav", "age": 38}], "solo", ["food"])
    assert named[0]["interests"] == ["food"] and named[0]["step_free"] is False


def test_a_step_free_traveller_is_vetoed_on_a_stairs_heavy_fort():
    fit = evaluate(normalise_members(FAMILY, "family", ["heritage"]), to_place(FORT), on=date(2026, 11, 10), start_min=540, theme_tags=["heritage"])
    by_name = {m["name"]: m for m in fit["members"]}
    assert by_name["Nani"]["veto"] and by_name["Nani"]["fit"] == 0
    assert by_name["Arav"]["veto"] is None and 0 < by_name["Arav"]["fit"] <= 100
    assert 0 <= fit["crowd"] <= 100


def test_group_fit_changes_the_score():
    place = to_place(FORT)
    members = normalise_members(FAMILY[:2], "family", ["heritage"])
    fit = evaluate(members, place, on=date(2026, 11, 10), start_min=540, theme_tags=["heritage"])
    with_fit = score_catalog_place(place, ["heritage"], {"lat": 26.9, "lng": 75.8}, fit)
    without = score_catalog_place(place, ["heritage"], {"lat": 26.9, "lng": 75.8})
    assert with_fit["groupFit"] == fit["group"] and "groupFit" not in without
    assert with_fit["score"] != without["score"]


def test_summary_reports_each_person_and_the_least_happy_as_fairness():
    members = normalise_members(FAMILY[:2], "family", ["heritage"])
    fit = evaluate(members, to_place(FORT), on=date(2026, 11, 10), start_min=540, theme_tags=["heritage"])
    summary = summarise(members, [{"title": "Hill fort walk", "memberFits": fit["members"]}])
    assert [m["name"] for m in summary["members"]] == ["Arav", "Kabir"]
    assert summary["fairness"] == min(m["avg"] for m in summary["members"])
    assert summarise(members, []) is None
