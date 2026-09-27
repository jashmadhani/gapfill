from typing import Optional

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from ..next_client import NextClient
from ..planning.moodcheck import mood_check_in


class MoodArgs(BaseModel):
    text: str = Field(description="What the traveller said about how they or the group feel, in their own words.")
    day: Optional[int] = Field(default=None, description="Which day of the trip to re-check (1-based). Omit for day 1.")


def make_tools(client: NextClient) -> list[StructuredTool]:
    async def check_in(text: str, day: Optional[int] = None) -> dict:
        return await mood_check_in(client, text, day)

    return [
        StructuredTool.from_function(
            name="mood_check_in",
            description=(
                "Use when the traveller says how they or the group feel (tired, hot, hungry, bored, kids restless, feeling adventurous...). "
                "Reads the mood, re-scores that day's stops for everyone in the group with a trained model, and returns which stops now fit "
                "worse and better-fitting swaps. It only proposes: it never changes the plan. Tell the traveller the trip admin can make the swap."
            ),
            args_schema=MoodArgs,
            coroutine=check_in,
        ),
    ]
