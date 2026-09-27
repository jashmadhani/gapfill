from pydantic import BaseModel
from langchain_core.tools import StructuredTool

from ..next_client import NextClient


class NoArgs(BaseModel):
    pass


def make_tools(client: NextClient) -> list[StructuredTool]:
    async def summarize_past_trips(**_: object) -> dict:
        return await client.get("/api/agent/trips/history")

    return [
        StructuredTool.from_function(
            name="summarize_past_trips",
            description=(
                "Get the user's completed trips, each with its post-trip rating/reflection, "
                "plus which themes (heritage, food, adventure, etc) they've favored across trips "
                "and how their spend has tracked against budget. Use this for questions like "
                "'how have my preferences changed' or 'what did I do on my last trip'."
            ),
            args_schema=NoArgs,
            coroutine=summarize_past_trips,
        )
    ]
