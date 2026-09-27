from typing import Optional

from pydantic import BaseModel, Field
from langchain_core.tools import StructuredTool

from ..next_client import NextClient


class ListTripsArgs(BaseModel):
    status: Optional[str] = Field(
        default=None,
        description="Filter by status: planning, upcoming, active, completed, or cancelled. Omit to list all trips.",
    )


class TripIdArgs(BaseModel):
    trip_id: str = Field(description="A trip's id from list_my_trips, or the literal string 'current' for the user's active/soonest-upcoming trip.")


def make_tools(client: NextClient) -> list[StructuredTool]:
    async def list_my_trips(status: Optional[str] = None) -> dict:
        return await client.get("/api/agent/trips", params={"status": status} if status else None)

    async def get_trip_details(trip_id: str) -> dict:
        return await client.get(f"/api/agent/trips/{trip_id}")

    return [
        StructuredTool.from_function(
            name="list_my_trips",
            description="List the user's trips: id, title, destination, status, dates, and theme tags. Optionally filter by status.",
            args_schema=ListTripsArgs,
            coroutine=list_my_trips,
        ),
        StructuredTool.from_function(
            name="get_trip_details",
            description=(
                "Get full detail for one trip: dates, multi-city route, group size, budget vs "
                "spend, pre-trip checklist, active risks/alerts, and a day-by-day plan summary. "
                "Pass trip_id='current' for the user's active or next upcoming trip."
            ),
            args_schema=TripIdArgs,
            coroutine=get_trip_details,
        ),
    ]
