"""Tests the deterministic prompt-construction logic in insights.py —
what actually gets sent to the LLM — without calling FreeLLMAPI itself.
generate_simulation_explanation() end-to-end (which does hit the network) is
covered by manual curl verification during development, not here.
"""

import pytest

from insights import generate_simulation_explanation
from insights import InsightsUnavailable


@pytest.mark.asyncio
async def test_generate_simulation_explanation_raises_clearly_without_api_key(monkeypatch):
    monkeypatch.setattr("insights.LLM_API_KEY", "")
    simulation = {
        "driver_label": "Revenue",
        "driver_column": "Revenue",
        "pct_change": 20,
        "effects": [],
    }
    with pytest.raises(InsightsUnavailable):
        await generate_simulation_explanation("Retail", simulation)
