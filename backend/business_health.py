"""Deterministic Business Health Score.

A single 0-100 rollup of four signals already computed elsewhere in this
backend — data quality, growth trend, forecast reliability, and risk
level — so a non-technical user gets one number instead of fifty metrics.
Every component is a direct function of numbers already computed
elsewhere; nothing here is invented or LLM-narrated.
"""

from __future__ import annotations

from typing import Any

from profiling import DataQualityReport


def _quality_component(quality: DataQualityReport | None) -> float:
    return quality.score if quality else 70.0  # neutral default when not computed


def _growth_component(forecast: dict[str, Any] | None, period_comparison: dict[str, Any] | None) -> float:
    if period_comparison and period_comparison.get("delta_pct") is not None:
        delta = period_comparison["delta_pct"]
        # 0% change -> 60 (neutral), +20% -> 85, -20% -> 35; clamped to [0, 100]
        return max(0.0, min(100.0, 60.0 + delta * 1.25))
    if forecast and forecast.get("trend"):
        return {"up": 75.0, "flat": 55.0, "down": 30.0}.get(forecast["trend"], 55.0)
    return 55.0  # no trend signal available either way


def _forecast_reliability_component(forecast: dict[str, Any] | None) -> float:
    if not forecast or not forecast.get("validation"):
        return 50.0  # no backtested forecast to judge
    mape = forecast["validation"].get("metrics", {}).get("mape")
    if mape is None:
        return 50.0
    return max(0.0, 100.0 - mape)


def _safety_component(risk_alerts: list[dict[str, Any]]) -> float:
    if not risk_alerts:
        return 90.0
    penalty = sum(30 if a.get("kind") == "threshold_crossing" else 18 for a in risk_alerts)
    return max(0.0, 100.0 - penalty)


def compute_business_health(
    quality: DataQualityReport | None,
    forecast: dict[str, Any] | None,
    period_comparison: dict[str, Any] | None,
    risk_alerts: list[dict[str, Any]],
) -> dict[str, Any]:
    components = {
        "data_quality": round(_quality_component(quality)),
        "growth": round(_growth_component(forecast, period_comparison)),
        "forecast_reliability": round(_forecast_reliability_component(forecast)),
        "safety": round(_safety_component(risk_alerts)),
    }
    overall = round(sum(components.values()) / len(components))
    return {"overall": overall, "components": components}
