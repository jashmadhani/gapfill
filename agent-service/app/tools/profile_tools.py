from pydantic import BaseModel
from langchain_core.tools import StructuredTool

from ..next_client import NextClient


class NoArgs(BaseModel):
    pass


def make_tools(client: NextClient) -> list[StructuredTool]:
    async def get_my_profile(**_: object) -> dict:
        return await client.get("/api/agent/profile")

    return [
        StructuredTool.from_function(
            name="get_my_profile",
            description=(
                "Get the current user's first name, home city, travel preferences "
                "(pace, budget style, dietary needs, home currency), trip/saved counts, "
                "and any long-term facts remembered about them. Never contains email, "
                "phone number, or account/auth data - you don't have access to those."
            ),
            args_schema=NoArgs,
            coroutine=get_my_profile,
        )
    ]
