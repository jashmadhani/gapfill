"""End-to-end smoke test of the full lifecycle. Run from backend/: python -m tests.smoke_test"""
import asyncio

from fastapi.testclient import TestClient

from app.main import app
from app.seed import reset_and_seed


def ok(r):
    assert r.status_code < 400, (r.status_code, r.text)
    return r.json()


def main():
    asyncio.run(reset_and_seed())
    with TestClient(app) as c:
        st = ok(c.get("/state"))
        tid = st["active_tour_id"]
        assert tid and st["active_day"] == 2, st

        # Discover
        d = ok(c.get("/discover?interests=food,heritage"))
        assert d["destinations"] and d["experiences"]
        ok(c.get(f"/destinations/{d['destinations'][0]['key']}"))
        ok(c.get(f"/offerings/{d['experiences'][0]['id']}"))

        # Personalize -> Plan -> Price
        t = ok(c.post("/tours/plan", json={"name": "Test Traveler", "days": 7, "destinations": ["jaipur", "udaipur", "jaisalmer"],
                                            "adults": 2, "children": 1, "budget": 150000, "hotel_tier": "premium",
                                            "interests": ["food", "adventure", "culture"], "pace": "packed"}))
        new_id = t["id"]
        acts = sum(1 for dd in t["days_detail"] for i in dd["items"] if i["kind"] == "activity")
        assert acts >= 5, acts
        print("planned:", t["title"], "·", t["pricing"]["total"], "notes:", t["notes"][:3])
        assert t["pricing"]["within_budget"] or t["notes"], t["pricing"]

        # Customise: alternatives + swap + add + remove + optimise
        act = next(i for dd in t["days_detail"] for i in dd["items"] if i["kind"] == "activity")
        alts = ok(c.get(f"/tours/{new_id}/items/{act['id']}/alternatives"))
        if alts["alternatives"]:
            ok(c.post(f"/tours/{new_id}/items/{act['id']}/swap", json={"offering_id": alts["alternatives"][0]["offering"]["id"]}))
        hotel = next(i for dd in t["days_detail"] for i in dd["items"] if i["kind"] == "hotel")
        halts = ok(c.get(f"/tours/{new_id}/items/{hotel['id']}/alternatives"))
        ok(c.post(f"/tours/{new_id}/items/{hotel['id']}/swap", json={"offering_id": halts["alternatives"][0]["offering"]["id"]}))
        tr = next(i for dd in t["days_detail"] for i in dd["items"] if i["kind"] == "transport")
        ok(c.get(f"/tours/{new_id}/items/{tr['id']}/alternatives"))
        ok(c.post(f"/tours/{new_id}/optimise"))

        # Book
        full = ok(c.get(f"/tours/{new_id}"))
        if any(x["level"] == "error" for x in full["conflicts"]):
            print("conflicts:", full["conflicts"])
        b = ok(c.post(f"/tours/{new_id}/book", json={"pay": "deposit"}))
        assert b["refs"] and b["tour"]["status"] == "booked"
        ok(c.post(f"/tours/{tid}/activate"))

        # Adapt: every trigger on the active (in-progress) tour
        tour = ok(c.get(f"/tours/{tid}"))
        today = next(dd for dd in tour["days_detail"] if dd["day"] == 2)
        r = ok(c.post("/changes/trigger", json={"trigger_type": "weather", "dest": today["dest"], "date": today["date"]}))
        print("weather:", r["note"], [(e["label"], [o["label"] for o in e["options"]]) for e in r["events"]])
        for e in r["events"]:
            if e["tour_id"] == tid:
                rec = next(o for o in e["options"] if o["recommended"])
                ok(c.post(f"/changes/{e['id']}/resolve", json={"action": "accept", "option": rec["key"]}))

        for body in ({"trigger_type": "transport_delay", "minutes": 150}, {"trigger_type": "transport_cancel"},
                     {"trigger_type": "hotel_issue"}, {"trigger_type": "running_late", "minutes": 60},
                     {"trigger_type": "budget_change", "new_budget": 140000}):
            r = ok(c.post("/changes/trigger", json=body))
            print(body["trigger_type"], "→", r["note"], [(o["label"], o["cost_delta"], o.get("recommended")) for e in r["events"] for o in e["options"]])
            for e in r["events"]:
                ok(c.post(f"/changes/{e['id']}/resolve", json={"action": "accept", "option": e["options"][0]["key"], "by": "operator"}))

        # Vendor side: close a vendor with an upcoming booking, confirm/decline requests
        tour = ok(c.get(f"/tours/{tid}"))
        future_act = next(i for dd in tour["days_detail"] for i in dd["items"] if i["kind"] == "activity" and not i["is_past"] and i["status"] == "booked")
        v = ok(c.get(f"/vendors/{future_act['vendor_id']}"))
        if v["requests"]:
            ok(c.post(f"/vendors/{v['id']}/bookings/{v['requests'][0]['id']}", json={"action": "confirm"}))
        r = ok(c.patch(f"/vendors/{future_act['vendor_id']}/status", json={"status": "closed"}))
        print("vendor closed → events:", r)
        pend = ok(c.get(f"/changes?tour_id={tid}&status=pending"))
        for e in pend:
            ok(c.post(f"/changes/{e['id']}/resolve", json={"action": "dismiss"}))
        ok(c.patch(f"/vendors/{future_act['vendor_id']}/status", json={"status": "open"}))

        # Assist
        for q in ["what's next today?", "add a cooking class tomorrow", "how much have I paid?", "make day 5 lighter",
                  "cheaper hotel in Udaipur", "call my coordinator", "skip the food trail", "I'm running 30 min late"]:
            r = ok(c.post(f"/tours/{tid}/chat", json={"text": q}))
            print(f"  > {q}\n    {r['reply'][:140]}")

        # Operator
        dash = ok(c.get("/operator/dashboard"))
        print("kpis:", dash["kpis"])
        ok(c.get("/operator/schedule"))
        ok(c.get("/operator/people"))
        ok(c.get("/operator/payments"))
        ts = ok(c.get("/operator/tasks"))
        if ts:
            ok(c.post(f"/operator/tasks/{ts[0]['id']}/done"))
        ok(c.post(f"/tours/{tid}/payments", json={"amount": 5000}))
        ok(c.patch(f"/tours/{tid}", json={"coordinator_id": 2}))
        ok(c.get("/vendors"))

        # Complete -> Review
        done = next(t for t in ok(c.get("/tours")) if t["stage"] == "complete")
        full = ok(c.get(f"/tours/{done['id']}"))
        acts = [i for dd in full["days_detail"] for i in dd["items"] if i["kind"] == "activity" and i["status"] == "booked"]
        ok(c.post(f"/tours/{done['id']}/review", json={"overall": 5, "text": "Great", "items": [{"item_id": a["id"], "rating": 5} for a in acts]}))

        # clock
        ok(c.post("/demo/clock", json={"day": 3, "time": "09:00"}))
        with c.websocket_connect("/ws") as ws:
            assert ws.receive_json()["type"] == "hello"
    print("SMOKE TEST PASSED")


if __name__ == "__main__":
    main()
