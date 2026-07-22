"""V2: distribution analysis.

Mean/median/mode/variance/percentiles are plain pandas. Skewness and
kurtosis come from scipy (Fisher definition — kurtosis of a normal
distribution is 0, not 3). Shape classification is a simple, documented
threshold rule, not a formal normality test — good enough to flag "this
column is heavily skewed, treat its mean with caution" without overstating
precision.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats

from schema_inference import ColumnSchema


def _coerce_numeric(df: pd.DataFrame, col: str) -> pd.Series:
    series = df[col]
    if series.dtype == object:
        return pd.to_numeric(series.astype(str).str.replace(r"[,$%]", "", regex=True), errors="coerce")
    return pd.to_numeric(series, errors="coerce")


def classify_shape(skewness: float, excess_kurtosis: float) -> str:
    if excess_kurtosis > 1.0:
        return "heavy_tailed"
    if skewness > 0.5:
        return "right_skewed"
    if skewness < -0.5:
        return "left_skewed"
    return "approximately_normal"


def compute_distribution(values: pd.Series) -> dict[str, Any] | None:
    valid = values.dropna()
    if len(valid) < 5:
        return None

    mode_result = valid.mode()
    mode = float(mode_result.iloc[0]) if not mode_result.empty else None

    skewness = float(scipy_stats.skew(valid)) if valid.std() > 0 else 0.0
    excess_kurtosis = float(scipy_stats.kurtosis(valid)) if valid.std() > 0 else 0.0

    return {
        "mean": round(float(valid.mean()), 3),
        "median": round(float(valid.median()), 3),
        "mode": round(mode, 3) if mode is not None else None,
        "variance": round(float(valid.var()), 3),
        "std": round(float(valid.std()), 3),
        "skewness": round(skewness, 3),
        "excess_kurtosis": round(excess_kurtosis, 3),
        "percentiles": {
            "p10": round(float(valid.quantile(0.10)), 3),
            "p25": round(float(valid.quantile(0.25)), 3),
            "p50": round(float(valid.quantile(0.50)), 3),
            "p75": round(float(valid.quantile(0.75)), 3),
            "p90": round(float(valid.quantile(0.90)), 3),
        },
        "shape": classify_shape(skewness, excess_kurtosis),
    }


def analyze_distributions(df: pd.DataFrame, schema: list[ColumnSchema]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for col in schema:
        if col.type != "numeric":
            continue
        dist = compute_distribution(_coerce_numeric(df, col.name))
        if dist:
            result[col.name] = dist
    return result
