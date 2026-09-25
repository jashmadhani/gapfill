"""End-to-end smoke test of the core loop. Run: python -m tests.smoke_test"""
import faulthandler

from fastapi.testclient import TestClient

from app.main import app


def main():
    faulthandler.dump_traceback_later(60, exit=True)
    with TestClient(app) as c:
        c.post("/demo/reset").raise_for_status()
        st = c.get("/state").json()
        itin = c.get(f"/itinerary/{st['active_itinerary_id']}").json()
        print("items:", [(i["type"], i["start_label"], i["end_label"], i["title"]) for i in itin["items"]])
        gap = itin["next_gap_id"]
        rec = c.get(f"/recommendations?slot_id={gap}").json()
        print("slot:", rec["slot"]["start"], "-", rec["slot"]["end"], "excluded:", rec["excluded"])
        print("primary:", rec["primary"]["experience"]["title"], "|", rec["primary"]["fit"]["reasoning"])
        print("backups:", [b["experience"]["title"] for b in rec["backups"]])
        print("bundle:", rec["bundle"] and [e["title"] for e in rec["bundle"]["experiences"]], rec["bundle"] and rec["bundle"]["total_price"])

        with c.websocket_connect("/ws") as ws:
            assert ws.receive_json()["type"] == "hello"
            for trig in [{"trigger_type": "weather", "weather_bad": True},
                         {"trigger_type": "time_shrink", "minutes": 45},
                         {"trigger_type": "budget_shrink", "new_budget": 500},
                         {"trigger_type": "unavailable", "vendor_id": 1}]:
                c.post("/demo/reset").raise_for_status()
                ws.receive_json()  # demo_reset
                r = c.post("/disruption/trigger", json=trig).json()
                ev = r["events"][0]
                pushed = []
                while not pushed or pushed[-1]["type"] != "itinerary_updated":
                    pushed.append(ws.receive_json())
                assert any(m["type"] == "disruption" for m in pushed), pushed
                alt = c.get(f"/disruption/{ev['id']}/alternatives").json()
                print(f"\n[{trig['trigger_type']}] {ev['reason']}")
                print("   primary:", alt["primary"]["experience"]["title"], "| backup:", alt["backup"] and alt["backup"]["experience"]["title"])
                res = c.post(f"/disruption/{ev['id']}/resolve", json={"action": "accept"}).json()
                print("   accepted ->", res)
                ws.receive_json(); ws.receive_json()
                itin = c.get(f"/itinerary/{st['active_itinerary_id']}").json()
                print("   timeline:", [(i["start_label"], i["title"], i["status"]) for i in itin["items"] if i["type"] != "booked"])

        c.post("/demo/reset")
        # add to gap + booking
        rec = c.get(f"/recommendations?slot_id={gap}").json()
        r = c.post(f"/itinerary/{st['active_itinerary_id']}/items", json={"slot_id": gap, "experience_ids": [rec["primary"]["experience"]["id"]]}).json()
        b = c.post("/booking/confirm", json={"itinerary_item_ids": r["created_item_ids"]}).json()
        print("\nbooking:", b["bookings"][0]["booking_ref"], b["total"])
        # intent
        print("intent:", c.post("/session/intent", json={"text": "something indoors and foodie under 400, quick"}).json())
        print("recs after intent:", c.get(f"/recommendations?slot_id={c.get('/itinerary/1').json()['next_gap_id']}").json()["primary"])
        c.post("/session/intent", json={"text": ""})
        # vendor onboarding
        answers = ["We're Kesar Pottery and we run a blue pottery painting class for beginners.",
                   "Near Hawa Mahal, in our family studio.",
                   "About 1.5 hours, ₹650 per person, up to 8 guests.",
                   "10am to 6pm, indoors.",
                   "Great for families, couples and solo travelers. Ground floor with seating and a washroom, it's quiet."]
        d = c.post("/vendor/onboard", json={"answers": answers}).json()
        print("\ndraft:", d)
        pub = c.post("/vendor/listings", json={"draft": d["draft"]}).json()
        print("published:", pub["experience"]["id"], pub["vendor_id"])
        print("vendor status:", c.patch("/vendor/2/status", json={"status": "slots", "slots_left": 1}).json()["status"])
        print("demand:", c.get("/vendor/1/demand-signals").json())


if __name__ == "__main__":
    main()
