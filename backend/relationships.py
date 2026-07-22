"""V2 backfill: relationship discovery and root cause exploration.

All of this is descriptive statistics over the uploaded table — Pearson
correlation between numeric columns, Cramer's V between categorical
columns (computed manually via a contingency table, no scipy dependency),
and an eta-squared variance decomposition for "which dimension explains
the change in this metric." Everything here is an *association*, and is
labeled as such — nothing here claims causation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations

import numpy as np
import pandas as pd

from schema_inference import ColumnSchema


def _coerce_numeric(df: pd.DataFrame, col: str) -> pd.Series:
    series = df[col]
    if series.dtype == object:
        return pd.to_numeric(series.astype(str).str.replace(r"[,$%]", "", regex=True), errors="coerce")
    return pd.to_numeric(series, errors="coerce")


def _strength_label(abs_value: float) -> str:
    if abs_value >= 0.5:
        return "strong"
    if abs_value >= 0.3:
        return "moderate"
    return "weak"


@dataclass
class NumericCorrelation:
    column_a: str
    column_b: str
    label_a: str
    label_b: str
    r: float
    strength: str
    direction: str  # "positive" | "negative"


def numeric_correlations(
    df: pd.DataFrame, schema: list[ColumnSchema], min_abs_r: float = 0.3, min_rows: int = 5
) -> list[NumericCorrelation]:
    numeric_cols = [c for c in schema if c.type == "numeric"]
    results: list[NumericCorrelation] = []

    for col_a, col_b in combinations(numeric_cols, 2):
        paired = pd.DataFrame(
            {"a": _coerce_numeric(df, col_a.name), "b": _coerce_numeric(df, col_b.name)}
        ).dropna()
        if len(paired) < min_rows or paired["a"].std() == 0 or paired["b"].std() == 0:
            continue

        r = float(np.corrcoef(paired["a"], paired["b"])[0, 1])
        if np.isnan(r) or abs(r) < min_abs_r:
            continue

        results.append(
            NumericCorrelation(
                column_a=col_a.name,
                column_b=col_b.name,
                label_a=col_a.semantic_label,
                label_b=col_b.semantic_label,
                r=round(r, 3),
                strength=_strength_label(abs(r)),
                direction="positive" if r > 0 else "negative",
            )
        )

    results.sort(key=lambda c: abs(c.r), reverse=True)
    return results


@dataclass
class CategoricalAssociation:
    column_a: str
    column_b: str
    label_a: str
    label_b: str
    cramers_v: float
    strength: str


def _cramers_v(contingency: pd.DataFrame) -> float:
    observed = contingency.to_numpy(dtype=float)
    n = observed.sum()
    if n == 0:
        return 0.0
    row_totals = observed.sum(axis=1, keepdims=True)
    col_totals = observed.sum(axis=0, keepdims=True)
    expected = row_totals @ col_totals / n
    with np.errstate(divide="ignore", invalid="ignore"):
        chi2 = np.nansum(np.where(expected > 0, (observed - expected) ** 2 / expected, 0.0))
    k = min(observed.shape[0] - 1, observed.shape[1] - 1)
    if k <= 0:
        return 0.0
    return float(np.sqrt(chi2 / (n * k)))


def categorical_associations(
    df: pd.DataFrame, schema: list[ColumnSchema], min_v: float = 0.1, min_rows: int = 10
) -> list[CategoricalAssociation]:
    cat_cols = [c for c in schema if c.type == "categorical"]
    results: list[CategoricalAssociation] = []

    for col_a, col_b in combinations(cat_cols, 2):
        paired = df[[col_a.name, col_b.name]].dropna()
        if len(paired) < min_rows:
            continue
        contingency = pd.crosstab(paired[col_a.name], paired[col_b.name])
        if contingency.shape[0] < 2 or contingency.shape[1] < 2:
            continue

        v = _cramers_v(contingency)
        if v < min_v:
            continue

        results.append(
            CategoricalAssociation(
                column_a=col_a.name,
                column_b=col_b.name,
                label_a=col_a.semantic_label,
                label_b=col_b.semantic_label,
                cramers_v=round(v, 3),
                strength=_strength_label(v),
            )
        )

    results.sort(key=lambda c: c.cramers_v, reverse=True)
    return results


@dataclass
class RootCauseDimension:
    dimension_column: str
    dimension_label: str
    variance_explained_pct: float
    top_segment: str
    top_segment_deviation_pct: float | None


@dataclass
class RootCauseAnalysis:
    metric_column: str
    metric_label: str
    dimensions: list[RootCauseDimension] = field(default_factory=list)
    note: str = (
        "Variance explained is an association (eta-squared from a one-way "
        "breakdown), not a proven cause of the change in this metric."
    )


def root_cause_breakdown(
    df: pd.DataFrame,
    schema: list[ColumnSchema],
    metric_column: str,
    max_dimensions: int = 3,
    min_group_rows: int = 3,
) -> RootCauseAnalysis | None:
    metric_schema = next((c for c in schema if c.name == metric_column), None)
    if metric_schema is None:
        return None

    values = _coerce_numeric(df, metric_column)
    overall_mean = values.mean()
    total_ss = float(((values - overall_mean) ** 2).sum())
    if total_ss == 0 or np.isnan(total_ss):
        return None

    dim_cols = [c for c in schema if c.type == "categorical" and c.name != metric_column]
    dimensions: list[RootCauseDimension] = []

    for dim in dim_cols:
        paired = pd.DataFrame({"group": df[dim.name], "value": values}).dropna()
        group_sizes = paired.groupby("group").size()
        if (group_sizes >= min_group_rows).sum() < 2:
            continue

        group_means = paired.groupby("group")["value"].mean()
        between_ss = float((group_sizes * (group_means - overall_mean) ** 2).sum())
        variance_explained = between_ss / total_ss

        top_group = (group_means - overall_mean).abs().idxmax()
        top_deviation_pct = None
        if overall_mean != 0:
            top_deviation_pct = round((group_means[top_group] - overall_mean) / abs(overall_mean) * 100, 1)

        dimensions.append(
            RootCauseDimension(
                dimension_column=dim.name,
                dimension_label=dim.semantic_label,
                variance_explained_pct=round(variance_explained * 100, 1),
                top_segment=str(top_group),
                top_segment_deviation_pct=top_deviation_pct,
            )
        )

    if not dimensions:
        return None

    dimensions.sort(key=lambda d: d.variance_explained_pct, reverse=True)
    return RootCauseAnalysis(
        metric_column=metric_column,
        metric_label=metric_schema.semantic_label,
        dimensions=dimensions[:max_dimensions],
    )
