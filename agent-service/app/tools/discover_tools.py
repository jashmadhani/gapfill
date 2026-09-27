from typing import Optional

from pydantic import BaseModel, Field
from langchain_core.tools import StructuredTool

from ..next_client import NextClient


class SearchArgs(BaseModel):
    query: Optional[str] = Field(default=None, description="Free-text search, e.g. 'cooking class' or a destination name.")
    interest: Optional[str] = Field(
        default=None,
        description="One of: heritage, food, culture, adventure, wildlife, nature, shopping, spiritual, relaxation, photography, nightlife, workshop.",
    )


def make_tools(client: NextClient) -> list[StructuredTool]:
    async def search_experiences(query: Optional[str] = None, interest: Optional[str] = None) -> dict:
        params = {}
        if query:
            params["q"] = query
        if interest:
            params["interest"] = interest
        return await client.get("/api/agent/discover", params=params or None)

    return [
        StructuredTool.from_function(
            name="search_experiences",
            description="Search bookable experiences and destinations, to recommend something new or answer 'what can I do in X'.",
            args_schema=SearchArgs,
            coroutine=search_experiences,
        )
    ]
