"""V3: future risk alerts.

Deterministic, derived directly from the forecast trend and validation
metrics (and, when available, the root-cause breakdown for the same
metric) — not free-form AI. insights.py is where an LLM is allowed to
narrate these; the alert itself is computed here.

Two kinds:
1. A directional decline alert (metric trending down, confidence from
   validation MAPE).
2. A threshold-crossing alert, only for metrics semantically labeled as
   a countable "Quantity" (a reasonable stand-in for inventory/stock —
   there's no dataset-specific "critical level" to assume otherwise, so
   this uses zero as the one threshold that's always meaningful for a
   count: it's out of stock).
"""

from __future__ import annotations

from typing import Any

from relationships import RootCauseAnalysis


def _periods_until_zero_crossing(
    last_historical_value: float, forecast_points: list[dict[str, Any]]
) -> float | None:
    prev_period, prev_value = 0, last_historical_value
    for i, point in enumerate(forecast_points, start=1):
        curr_value = point["value"]
        if prev_value > 0 and curr_value <= 0:
            frac = prev_value / (prev_value - curr_value) if (prev_value - curr_value) != 0 else 0
            return prev_period + frac
        prev_period, prev_value = i, curr_value
    return None


def generate_risk_alerts(
    forecast: dict[str, Any] | None,
    root_cause: RootCauseAnalysis | None,
    metric_semantic_label: str | None = None,
) -> list[dict[str, Any]]:
    alerts: list[dict[str, Any]] = []

    if not forecast or not forecast.get("forecast"):
        return alerts

    validation = forecast.get("validation")
    confidence_pct = None
    if validation and validation.get("metrics", {}).get("mape") is not None:
        confidence_pct = round(max(0.0, 100 - validation["metrics"]["mape"]), 0)

    primary_driver = root_cause.dimensions[0].dimension_label if root_cause and root_cause.dimensions else None

    if forecast.get("trend") == "down":
        alerts.append(
            {
                "kind": "decline",
                "metric": forecast.get("column", "primary metric"),
                "direction": "decline",
                "confidence_pct": confidence_pct,
                "primary_driver": primary_driver,
                "note": "Derived directly from the forecast trend and validation metrics — not free-form AI.",
            }
        )

        if metric_semantic_label == "Quantity" and forecast.get("history"):
            last_value = forecast["history"][-1]["value"]
            periods_until = _periods_until_zero_crossing(last_value, forecast["forecast"])
            if periods_until is not None:
                alerts.append(
                    {
                        "kind": "threshold_crossing",
                        "metric": forecast.get("column", "primary metric"),
                        "direction": "critical_level",
                        "periods_until_critical": round(periods_until, 1),
                        "confidence_pct": confidence_pct,
                        "primary_driver": primary_driver,
                        "note": "Projected via linear interpolation of the forecast reaching zero — not free-form AI.",
                    }
                )

    return alerts
