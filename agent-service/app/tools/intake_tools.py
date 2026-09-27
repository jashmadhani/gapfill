from pydantic import BaseModel, Field
from langchain_core.tools import StructuredTool


class FinalizeIntakeArgs(BaseModel):
    destination: str = Field(description="The city, region, or country the user wants to visit.")
    start_date: str = Field(description="Trip start date, formatted YYYY-MM-DD.")
    end_date: str = Field(description="Trip end date, formatted YYYY-MM-DD.")
    budget: float = Field(default=0, description="Total trip budget in the user's currency, 0 if not mentioned.")
    group_type: str = Field(default="solo", description="One of: solo, couple, family, large_group.")
    theme_tags: list[str] = Field(
        default_factory=list,
        description="0-4 of: heritage, culture, food, adventure, nature, relaxation, nightlife, shopping - only ones the user actually mentioned or clearly implied.",
    )


def make_tools() -> list[StructuredTool]:
    async def finalize_trip_intake(**kwargs) -> dict:
        # The tool's return value IS the signal - main.py scans for this call
        # in the run's tool messages and triggers plan generation from its args,
        # the same pattern navigate_app uses for the Ask tab.
        return kwargs

    return [
        StructuredTool.from_function(
            name="finalize_trip_intake",
            description=(
                "Call this ONCE you have destination, start_date and end_date from the user (budget/group/themes are "
                "nice to have but not required) - it triggers plan generation. Ask a short follow-up question instead "
                "of calling this if destination or dates are still missing or ambiguous."
            ),
            args_schema=FinalizeIntakeArgs,
            coroutine=finalize_trip_intake,
        )
    ]
