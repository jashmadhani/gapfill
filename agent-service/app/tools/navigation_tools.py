from typing import Optional

from pydantic import BaseModel, Field
from langchain_core.tools import StructuredTool


class NavigateArgs(BaseModel):
    target: str = Field(description="Which tab to send the user to: discover, trip, plan, ask, or profile.")
    reason: Optional[str] = Field(default=None, description="One short phrase on why, e.g. 'to see the full day-by-day plan'.")


def make_tools() -> list[StructuredTool]:
    async def navigate_app(target: str, reason: Optional[str] = None) -> dict:
        # The tool's own "result" IS the instruction - main.py scans the run's
        # tool messages for this one and relays it to the frontend, which
        # performs the actual route change.
        return {"target": target, "reason": reason}

    return [
        StructuredTool.from_function(
            name="navigate_app",
            description=(
                "Send the user to a specific tab of the app when that's the clearest next step - "
                "e.g. 'open my day-by-day plan' -> plan, 'show my current trip' -> trip, "
                "'change my settings' -> profile. Only use this when the user asked to go "
                "somewhere or it's clearly the most helpful action, not on every turn."
            ),
            args_schema=NavigateArgs,
            coroutine=navigate_app,
        )
    ]
