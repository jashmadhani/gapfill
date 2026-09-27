import asyncio

from app.safety import redact
from app.tools import ticketing_tools as T


class FakeClient:
    def __init__(self):
        self.posts, self.gets = [], []

    async def get(self, path, params=None):
        self.gets.append(path)
        return {"ok": True}

    async def post(self, path, json):
        self.posts.append((path, json))
        return {"proposed": True}


def names(client):
    return {t.name for t in T.make_tools(T.Gateway(client))}


def test_the_assistant_has_no_tool_that_moves_money():
    tools = names(FakeClient())
    assert tools == {"get_payments", "propose_booking", "propose_balance_payment"}
    assert not any(w in n for n in tools for w in ("approve", "pay_", "refund", "charge", "confirm", "card"))


def test_only_propose_routes_are_reachable_and_they_are_the_only_money_paths():
    c = FakeClient()
    g = T.Gateway(c)
    asyncio.run(g.run("propose_booking", {"pay": "full"}, lambda: c.post("/api/agent/payments/propose", {"kind": "booking"}), proposal=True))
    assert [p for p, _ in c.posts if "payments" in p] == ["/api/agent/payments/propose"]


def test_unlisted_actions_are_blocked_and_audited():
    c = FakeClient()
    g = T.Gateway(c)
    out = asyncio.run(g.run("approve_payment", {}, lambda: c.post("/api/payments/x/approve", {})))
    assert out["blocked"] and not any("approve" in p and "audit" not in p for p, _ in c.posts)
    assert any(p == "/api/agent/audit" and j["outcome"] == "blocked" for p, j in c.posts)


def test_proposals_per_turn_are_capped():
    c = FakeClient()
    g = T.Gateway(c)
    results = [asyncio.run(g.run("propose_booking", {}, lambda: c.post("/api/agent/payments/propose", {}), proposal=True)) for _ in range(5)]
    assert sum(1 for r in results if r.get("proposed")) == T.MAX_PROPOSALS
    assert results[-1]["blocked"]


def test_every_call_is_audited():
    c = FakeClient()
    g = T.Gateway(c)
    asyncio.run(g.run("get_payments", {}, lambda: c.get("/api/agent/payments")))
    assert any(p == "/api/agent/audit" and j["action"] == "get_payments" for p, j in c.posts)


def test_secrets_are_removed_before_the_model_sees_them():
    text, found = redact("my card is 4111 1111 1111 1111 cvv 123 and upi pin 482913, otp: 556677")
    assert "4111" not in text and "482913" not in text and "556677" not in text and "123" not in text
    assert {"card_number", "cvv", "pin_otp"} <= set(found)
    clean, none = redact("Book the Jaipur trip for 4 people on 12 Nov")
    assert clean.startswith("Book the Jaipur") and none == []
