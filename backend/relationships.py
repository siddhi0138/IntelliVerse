"""V2: relationship discovery and root cause exploration.

Numeric relationships use Pearson correlation by default, switching to
Spearman (rank-based, no linearity/normality assumption) when either
column is heavily skewed — with the p-value from whichever test was
actually run, so "significant" means something. Categorical associations
use Cramer's V from a contingency table, with significance from a
chi-square test of independence on the same table. Root
cause uses an eta-squared effect size plus a real significance test —
one-way ANOVA when the metric looks roughly normal within groups,
Kruskal-Wallis (rank-based, no normality assumption) otherwise. Everything
here is an *association*, labeled as such — nothing here claims causation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats

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


def _looks_skewed(values: pd.Series, threshold: float = 1.0) -> bool:
    if values.std() == 0 or len(values) < 8:
        return False
    return bool(abs(scipy_stats.skew(values)) > threshold)


@dataclass
class NumericCorrelation:
    column_a: str
    column_b: str
    label_a: str
    label_b: str
    r: float
    p_value: float
    method: str  # "pearson" | "spearman"
    significant: bool  # p < 0.05
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

        if _looks_skewed(paired["a"]) or _looks_skewed(paired["b"]):
            method = "spearman"
            r, p_value = scipy_stats.spearmanr(paired["a"], paired["b"])
        else:
            method = "pearson"
            r, p_value = scipy_stats.pearsonr(paired["a"], paired["b"])

        r, p_value = float(r), float(p_value)
        if np.isnan(r) or abs(r) < min_abs_r:
            continue

        results.append(
            NumericCorrelation(
                column_a=col_a.name,
                column_b=col_b.name,
                label_a=col_a.semantic_label,
                label_b=col_b.semantic_label,
                r=round(r, 3),
                p_value=round(p_value, 4),
                method=method,
                significant=p_value < 0.05,
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
    p_value: float
    significant: bool  # p < 0.05
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

        _, p_value, _, _ = scipy_stats.chi2_contingency(contingency)
        p_value = float(p_value)

        results.append(
            CategoricalAssociation(
                column_a=col_a.name,
                column_b=col_b.name,
                label_a=col_a.semantic_label,
                label_b=col_b.semantic_label,
                cramers_v=round(v, 3),
                p_value=round(p_value, 4),
                significant=p_value < 0.05,
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
    test_used: str  # "anova" | "kruskal_wallis"
    test_statistic: float
    p_value: float
    significant: bool  # p < 0.05


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
    metric_is_skewed = _looks_skewed(values.dropna())

    for dim in dim_cols:
        paired = pd.DataFrame({"group": df[dim.name], "value": values}).dropna()
        group_sizes_all = paired.groupby("group").size()
        eligible_groups = group_sizes_all[group_sizes_all >= min_group_rows].index
        if len(eligible_groups) < 2:
            continue

        # Everything below — the significance test AND the variance-explained
        # calculation — must use only the eligible-group rows consistently.
        # Mixing an eligible-only numerator with a whole-dataset denominator
        # (or vice versa) lets a single tiny/noisy excluded group dominate
        # variance_explained_pct and top_segment even though it was just
        # excluded for being too small to trust.
        eligible_paired = paired[paired["group"].isin(eligible_groups)]
        groups = [eligible_paired.loc[eligible_paired["group"] == g, "value"] for g in eligible_groups]

        if metric_is_skewed:
            test_used = "kruskal_wallis"
            statistic, p_value = scipy_stats.kruskal(*groups)
        else:
            test_used = "anova"
            statistic, p_value = scipy_stats.f_oneway(*groups)
        statistic, p_value = float(statistic), float(p_value)

        dim_mean = float(eligible_paired["value"].mean())
        dim_total_ss = float(((eligible_paired["value"] - dim_mean) ** 2).sum())
        if dim_total_ss == 0:
            continue

        group_sizes = eligible_paired.groupby("group").size()
        group_means = eligible_paired.groupby("group")["value"].mean()
        between_ss = float((group_sizes * (group_means - dim_mean) ** 2).sum())
        variance_explained = between_ss / dim_total_ss

        top_group = (group_means - dim_mean).abs().idxmax()
        top_deviation_pct = None
        if dim_mean != 0:
            top_deviation_pct = round((group_means[top_group] - dim_mean) / abs(dim_mean) * 100, 1)

        dimensions.append(
            RootCauseDimension(
                dimension_column=dim.name,
                dimension_label=dim.semantic_label,
                variance_explained_pct=round(variance_explained * 100, 1),
                top_segment=str(top_group),
                top_segment_deviation_pct=top_deviation_pct,
                test_used=test_used,
                test_statistic=round(statistic, 3) if not np.isnan(statistic) else 0.0,
                p_value=round(p_value, 4) if not np.isnan(p_value) else 1.0,
                significant=(not np.isnan(p_value)) and p_value < 0.05,
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
