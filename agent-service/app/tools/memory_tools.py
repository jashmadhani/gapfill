from pydantic import BaseModel, Field
from langchain_core.tools import StructuredTool

from ..next_client import NextClient


class RememberArgs(BaseModel):
    fact: str = Field(
        description=(
            "One short, durable fact about the user's taste or constraints worth carrying into "
            "future chats, e.g. 'prefers window seats' or 'traveling with a toddler in 2026'. "
            "Not for one-off details that only matter in this message."
        )
    )


def make_tools(client: NextClient) -> list[StructuredTool]:
    async def remember_fact(fact: str) -> dict:
        return await client.post("/api/agent/memory", {"fact": fact})

    return [
        StructuredTool.from_function(
            name="remember_fact",
            description="Save a durable fact about the user's preferences or constraints so future chats already know it.",
            args_schema=RememberArgs,
            coroutine=remember_fact,
        )
    ]
