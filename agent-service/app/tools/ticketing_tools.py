from typing import Optional

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from ..next_client import NextClient

# ------------------------------------------------------------------ the gateway
# Everything the assistant can do with money or tickets goes through here. The allowlist is the security boundary:
# there is NO tool that approves, pays, records a payment, refunds, or reads payment details. Those exist only behind
# the traveller's own tap in the app (cookie session), and the agent's token cannot reach them.
ALLOWED = ("get_payments", "propose_booking", "propose_balance_payment", "report_weather", "report_running_late", "list_pending_changes",
           "propose_change_option")
MAX_TOOL_CALLS = 10  # per chat turn
MAX_PROPOSALS = 3  # per chat turn


class Gateway:
    """One per chat turn. Counts calls, blocks over-limit ones, and records every call in the audit trail."""

    def __init__(self, client: NextClient):
        self.client = client
        self.calls = 0
        self.proposals = 0

    async def log(self, action: str, detail: dict, outcome: str = "ok") -> None:
        try:
            await self.client.post("/api/agent/audit", {"action": action, "detail": detail, "outcome": outcome})
        except Exception:
            pass  # auditing must never break the traveller's request

    async def run(self, name: str, detail: dict, fn, *, proposal: bool = False):
        if name not in ALLOWED:
            await self.log(name, detail, "blocked")
            return {"blocked": True, "reason": "That action isn't available to the assistant."}
        self.calls += 1
        if self.calls > MAX_TOOL_CALLS or (proposal and self.proposals >= MAX_PROPOSALS):
            await self.log(name, detail, "blocked")
            return {"blocked": True, "reason": "Too many actions in one request. Ask again in a new message."}
        if proposal:
            self.proposals += 1
        try:
            result = await fn()
        except Exception as exc:
            await self.log(name, {**detail, "error": type(exc).__name__}, "error")
            return {"error": "That didn't work. Try again in a moment."}
        await self.log(name, detail)
        return result


class NoArgs(BaseModel):
    pass


class BookingArgs(BaseModel):
    pay: str = Field(default="deposit", description="'deposit' (30% now) or 'full'.")


def make_tools(gateway: Gateway) -> list[StructuredTool]:
    c = gateway.client

    async def get_payments() -> dict:
        return await gateway.run("get_payments", {}, lambda: c.get("/api/agent/payments"))

    async def propose_booking(pay: str = "deposit") -> dict:
        pay = "full" if pay == "full" else "deposit"
        return await gateway.run("propose_booking", {"pay": pay}, lambda: c.post("/api/agent/payments/propose", {"kind": "booking", "pay": pay}), proposal=True)

    async def propose_balance_payment() -> dict:
        return await gateway.run("propose_balance_payment", {}, lambda: c.post("/api/agent/payments/propose", {"kind": "balance"}), proposal=True)

    return [
        StructuredTool.from_function(
            name="get_payments",
            description="The trip's total, amount paid, balance, any approval waiting for the traveller, and their tickets. Never includes card or bank details.",
            args_schema=NoArgs, coroutine=get_payments,
        ),
        StructuredTool.from_function(
            name="propose_booking",
            description=(
                "Prepare the payment to book the whole draft trip. This ONLY creates an approval card for the traveller; nothing is charged. "
                "pay is 'deposit' (30%) or 'full'. After calling it, tell the traveller the amount and that they must review and approve the card themselves."
            ),
            args_schema=BookingArgs, coroutine=propose_booking,
        ),
        StructuredTool.from_function(
            name="propose_balance_payment",
            description="Prepare the payment for the remaining balance of a booked trip. Only creates an approval card; nothing is charged.",
            args_schema=NoArgs, coroutine=propose_balance_payment,
        ),
    ]
