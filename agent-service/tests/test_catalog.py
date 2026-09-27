from app.planning.catalog import build_considered, excluded_reason, explain_left_out, score_catalog_place, to_place, trip_weekdays

CENTER = {"lat": 26.9124, "lng": 75.7873}


def poi(name, tags, rating=4.5, price=500, closed=None, kids=True, lat=26.92, lng=75.79, best="all", open_min=540):
    return to_place({
        "poiId": f"id_{name}", "id": name, "name": name, "lat": lat, "lng": lng, "price": price, "rating": rating, "ratingCount": 300,
        "tags": tags, "category": "heritage", "durationMin": 90, "indoorOutdoor": "outdoor", "stepFree": True,
        "attrs": {"kidFriendly": kids, "closedWeekdays": closed or [], "minAge": 12, "bestTime": best, "openMin": open_min},
    })


def test_closed_every_trip_day_is_excluded():
    monday_only = trip_weekdays("2026-11-09", 1)  # a Monday
    assert monday_only == [0]
    p = poi("Museum", ["heritage"], closed=[0])
    assert "Closed on Monday" in excluded_reason(p, group_type="couple", budget=0, weekdays=monday_only)
    assert excluded_reason(p, group_type="couple", budget=0, weekdays=trip_weekdays("2026-11-09", 3)) is None


def test_family_trip_excludes_places_not_for_children():
    p = poi("Zipline", ["adventure"], kids=False)
    assert "children" in excluded_reason(p, group_type="family", budget=0, weekdays=[1])
    assert excluded_reason(p, group_type="couple", budget=0, weekdays=[1]) is None


def test_single_stop_over_forty_percent_of_budget_is_excluded():
    p = poi("Private jet tour", ["adventure"], price=9000)
    assert "40%" in excluded_reason(p, group_type="solo", budget=20000, weekdays=[1])


def test_interest_match_outranks_a_closer_non_match():
    match = score_catalog_place(poi("Fort", ["heritage"]), ["heritage"], CENTER)
    other = score_catalog_place(poi("Bazaar", ["shopping"]), ["heritage"], CENTER)
    assert match["score"] > other["score"]
    assert other["themeHits"] == 0


def test_left_out_reasons_are_specific_and_capped():
    picked = [score_catalog_place(poi("Fort", ["heritage"], rating=4.9), ["heritage"], CENTER)]
    far = score_catalog_place(poi("Far bazaar", ["shopping"], rating=4.0, lat=27.05), ["heritage"], CENTER)
    reasons = explain_left_out(far, rank=5, slots=4, theme_tags=["heritage"], selected=picked)
    assert reasons[0].startswith("Doesn't match your interests")
    assert any("km from the centre" in r for r in reasons)
    assert len(reasons) <= 3


def test_considered_lists_near_misses_then_exclusions_with_prices():
    a = score_catalog_place(poi("A", ["heritage"]), ["heritage"], CENTER)
    b = score_catalog_place(poi("B", ["heritage"], price=800), ["heritage"], CENTER)
    out = build_considered([a, b], [a], [(poi("C", ["food"]), "Closed on Monday")], slots=1, theme_tags=["heritage"])
    assert [c["name"] for c in out] == ["B", "C"]
    assert out[0]["price"] == 800 and out[0]["verdict"] == "left_out" and out[0]["rank"] == 2
    assert out[1]["verdict"] == "excluded" and out[1]["reasons"] == ["Closed on Monday"]
