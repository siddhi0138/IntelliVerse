"""V4: decision simulation via correlation + linear regression.

Explicitly models *associations*, not causal effects: changing a driver
column propagates to other numeric columns via a fitted linear regression
between them across historical rows, with R-squared reported as the
confidence in that association. No business mechanism (marketing,
hiring, supply chains) is assumed or invented — the only "decisions"
offered are adjustments to columns that actually exist in the uploaded
data (see `build_decision_actions`).

`SimulationEngine` is a `Protocol` so v5/v6 can swap in a Bayesian network,
a structural causal model, or a multi-table digital twin without touching
the API shape or the frontend — callers only depend on `propagate()`
returning a `SimulationResult`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

import numpy as np
import pandas as pd

from schema_inference import ColumnSchema

ASSOCIATION_NOTE = (
    "These projections are statistical associations derived from historical "
    "correlations in this dataset, not proven causal effects. They assume "
    "past relationships between metrics continue to hold — actual outcomes "
    "may differ, especially for large changes or small sample sizes."
)


@dataclass
class PropagatedEffect:
    column: str
    semantic_label: str
    baseline: float
    projected: float
    delta_pct: float | None
    r_squared: float
    confidence: str  # "high" | "medium" | "low"
    relationship: str  # "direct change" | "positive association" | "negative association"


@dataclass
class SimulationResult:
    driver_column: str
    driver_label: str
    pct_change: float
    effects: list[PropagatedEffect] = field(default_factory=list)
    note: str = ASSOCIATION_NOTE


class SimulationEngine(Protocol):
    def propagate(
        self, df: pd.DataFrame, schema: list[ColumnSchema], driver_column: str, pct_change: float
    ) -> SimulationResult: ...


def _confidence_bucket(r_squared: float) -> str:
    if r_squared >= 0.5:
        return "high"
    if r_squared >= 0.2:
        return "medium"
    return "low"


def _coerce_numeric(df: pd.DataFrame, col: str) -> pd.Series:
    series = df[col]
    if series.dtype == object:
        return pd.to_numeric(series.astype(str).str.replace(r"[,$%]", "", regex=True), errors="coerce")
    return pd.to_numeric(series, errors="coerce")


class CorrelationRegressionEngine:
    """V4 default engine: pairwise linear regression against the driver column."""

    min_paired_rows = 5

    def propagate(
        self, df: pd.DataFrame, schema: list[ColumnSchema], driver_column: str, pct_change: float
    ) -> SimulationResult:
        driver_schema = next((c for c in schema if c.name == driver_column), None)
        driver_label = driver_schema.semantic_label if driver_schema else driver_column

        driver_vals_full = _coerce_numeric(df, driver_column)
        baseline_driver_sum = float(driver_vals_full.dropna().sum())

        effects = [
            PropagatedEffect(
                column=driver_column,
                semantic_label=driver_label,
                baseline=baseline_driver_sum,
                projected=baseline_driver_sum * (1 + pct_change / 100),
                delta_pct=pct_change,
                r_squared=1.0,
                confidence="high",
                relationship="direct change",
            )
        ]

        numeric_cols = [c for c in schema if c.type == "numeric" and c.name != driver_column]

        for col in numeric_cols:
            dep_vals_full = _coerce_numeric(df, col.name)
            paired = pd.DataFrame({"driver": driver_vals_full, "dep": dep_vals_full}).dropna()
            if len(paired) < self.min_paired_rows:
                continue
            if paired["driver"].std() == 0 or paired["dep"].std() == 0:
                continue

            slope, intercept = np.polyfit(paired["driver"], paired["dep"], 1)
            corr = np.corrcoef(paired["driver"], paired["dep"])[0, 1]
            r_squared = float(corr**2) if not np.isnan(corr) else 0.0

            baseline_dep_sum = float(paired["dep"].sum())
            n = len(paired)
            new_driver_sum = float(paired["driver"].sum()) * (1 + pct_change / 100)
            projected_dep_sum = float(slope * new_driver_sum + intercept * n)

            delta_pct = None
            if baseline_dep_sum != 0:
                delta_pct = round((projected_dep_sum - baseline_dep_sum) / abs(baseline_dep_sum) * 100, 2)

            relationship = "positive association" if slope > 0 else "negative association"

            effects.append(
                PropagatedEffect(
                    column=col.name,
                    semantic_label=col.semantic_label,
                    baseline=round(baseline_dep_sum, 2),
                    projected=round(projected_dep_sum, 2),
                    delta_pct=delta_pct,
                    r_squared=round(r_squared, 3),
                    confidence=_confidence_bucket(r_squared),
                    relationship=relationship,
                )
            )

        # keep the driver first, then strongest associations
        driver_effect, *rest = effects
        rest.sort(key=lambda e: e.r_squared, reverse=True)
        effects = [driver_effect, *rest[:6]]

        return SimulationResult(
            driver_column=driver_column,
            driver_label=driver_label,
            pct_change=pct_change,
            effects=effects,
        )


def build_decision_actions(schema: list[ColumnSchema]) -> list[dict]:
    """Only offer decisions for numeric columns that actually exist in this dataset."""
    return [
        {
            "id": col.name,
            "column": col.name,
            "label": f"Adjust {col.semantic_label}",
            "semantic_label": col.semantic_label,
            "default_pct": 20,
        }
        for col in schema
        if col.type == "numeric"
    ]
