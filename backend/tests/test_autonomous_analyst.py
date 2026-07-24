import pytest

from autonomous_analyst import generate_action_plan
from insights import InsightsUnavailable


@pytest.mark.asyncio
async def test_generate_action_plan_raises_clearly_without_api_key(monkeypatch):
    monkeypatch.setattr("insights.LLM_API_KEY", "")
    with pytest.raises(InsightsUnavailable, match="FREELLMAPI_API_KEY"):
        await generate_action_plan("Retail", [], [], None, None, None, None)
