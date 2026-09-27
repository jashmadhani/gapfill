from typing import Optional

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from ..planning.disruption import run_trigger
from .ticketing_tools import Gateway


class DayArgs(BaseModel):
    day: Optional[int] = Field(default=None, description="Day of the trip (1-based). Omit for day 1.")


class LateArgs(BaseModel):
    minutes: int = Field(description="How late the group is running, in minutes.")
    day: Optional[int] = Field(default=None, description="Day of the trip (1-based).")
    from_time: Optional[str] = Field(default=None, description="Only stops starting at or after this time, 24h HH:MM.")


class NoArgs(BaseModel):
    pass


class ChooseArgs(BaseModel):
    change_id: str = Field(description="The change's id from list_pending_changes.")
    option: str = Field(description="The option key, e.g. 'A'.")


def make_tools(gateway: Gateway) -> list[StructuredTool]:
    c = gateway.client

    async def report_weather(day: Optional[int] = None) -> dict:
        return await gateway.run("report_weather", {"day": day}, lambda: run_trigger(c, {"type": "weather", "day": day}))

    async def report_running_late(minutes: int, day: Optional[int] = None, from_time: Optional[str] = None) -> dict:
        return await gateway.run("report_running_late", {"minutes": minutes, "day": day},
                                 lambda: run_trigger(c, {"type": "running_late", "minutes": minutes, "day": day, "fromTime": from_time}))

    async def list_pending_changes() -> dict:
        return await gateway.run("list_pending_changes", {}, lambda: c.get("/api/agent/disruptions"))

    async def propose_change_option(change_id: str, option: str) -> dict:
        return await gateway.run("propose_change_option", {"change_id": change_id, "option": option},
                                 lambda: c.post("/api/agent/payments/propose", {"kind": "change", "changeId": change_id, "option": option.upper()[:1]}), proposal=True)

    return [
        StructuredTool.from_function(name="report_weather", args_schema=DayArgs, coroutine=report_weather,
                                     description="Tell the disruption engine it is raining (or will) on a day. It prepares indoor swaps, a lighter day, or keeping the plan, each scored on group fit, cost and time. Nothing changes until the trip admin picks one."),
        StructuredTool.from_function(name="report_running_late", args_schema=LateArgs, coroutine=report_running_late,
                                     description="Tell the disruption engine the group is running late. It prepares options (push the day back, or skip the next stop) and flags stops that would close. Nothing changes until the trip admin picks one."),
        StructuredTool.from_function(name="list_pending_changes", args_schema=NoArgs, coroutine=list_pending_changes,
                                     description="Changes waiting for the trip admin's decision, with each option's group fit, cost per person and time lost."),
        StructuredTool.from_function(name="propose_change_option", args_schema=ChooseArgs, coroutine=propose_change_option,
                                     description="Prepare the traveller's chosen option for a pending change as an approval card. It does not apply it; the trip admin approves it in the app (and pays if it costs extra)."),
    ]
