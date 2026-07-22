"""V3 backfill: future risk alerts.

Deterministic, derived directly from the forecast trend and validation
metrics (and, when available, the root-cause breakdown for the same
metric) — not free-form AI. insights.py is where an LLM is allowed to
narrate these; the alert itself is computed here.
"""

from __future__ import annotations

from typing import Any

from relationships import RootCauseAnalysis


def generate_risk_alerts(
    forecast: dict[str, Any] | None,
    root_cause: RootCauseAnalysis | None,
) -> list[dict[str, Any]]:
    if not forecast or not forecast.get("forecast") or forecast.get("trend") != "down":
        return []

    validation = forecast.get("validation")
    confidence_pct = None
    if validation and validation.get("metrics", {}).get("mape") is not None:
        confidence_pct = round(max(0.0, 100 - validation["metrics"]["mape"]), 0)

    primary_driver = root_cause.dimensions[0].dimension_label if root_cause and root_cause.dimensions else None

    return [
        {
            "metric": forecast.get("column", "primary metric"),
            "direction": "decline",
            "confidence_pct": confidence_pct,
            "primary_driver": primary_driver,
            "note": "Derived directly from the forecast trend and validation metrics — not free-form AI.",
        }
    ]
