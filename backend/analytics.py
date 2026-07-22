"""Anomaly detection: per-column univariate outliers (IQR or Z-score,
chosen by distribution shape), plus time-series-aware checks (sudden
period-over-period spikes and lag-based seasonality) over the same
monthly-aggregated series used for forecasting. Multivariate anomalies
(unusual combinations of values, not just single-column outliers) live in
anomalies_ml.py. Forecasting itself lives in forecasting.py.
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


def _iqr_bounds(valid: pd.Series) -> tuple[float, float] | None:
    q1, q3 = valid.quantile(0.25), valid.quantile(0.75)
    iqr = q3 - q1
    if iqr == 0:
        return None
    return float(q1 - 1.5 * iqr), float(q3 + 1.5 * iqr)


def _zscore_bounds(valid: pd.Series, threshold: float = 3.0) -> tuple[float, float] | None:
    if valid.std() == 0:
        return None
    mean = float(valid.mean())
    std = float(valid.std())
    return mean - threshold * std, mean + threshold * std


def detect_anomalies(
    df: pd.DataFrame,
    schema: list[ColumnSchema],
    id_column: str | None = None,
    max_anomalies: int = 8,
) -> list[dict[str, Any]]:
    anomalies: list[dict[str, Any]] = []

    for col in schema:
        if col.type != "numeric":
            continue
        series = _coerce_numeric(df, col.name)
        valid = series.dropna()
        if len(valid) < 5:
            continue

        # Z-score assumes roughly-normal data; fall back to the
        # distribution-free IQR test when the column is heavily skewed.
        skewed = valid.std() > 0 and abs(scipy_stats.skew(valid)) > 1.0
        method = "iqr" if skewed else "zscore"
        bounds = _iqr_bounds(valid) if method == "iqr" else _zscore_bounds(valid)
        if bounds is None:
            continue
        lower_bound, upper_bound = bounds

        outlier_mask = (series < lower_bound) | (series > upper_bound)

        for idx in series[outlier_mask].index:
            value = float(series[idx])
            direction = "above" if value > upper_bound else "below"
            bound = float(upper_bound) if direction == "above" else float(lower_bound)
            identifier = str(df.loc[idx, id_column]) if id_column and id_column in df.columns else f"row {idx}"
            anomalies.append(
                {
                    "column": col.name,
                    "semantic_label": col.semantic_label,
                    "row": identifier,
                    "value": value,
                    "direction": direction,
                    "method": method,
                    "bounds": {"lower": float(lower_bound), "upper": float(upper_bound)},
                    "_deviation": abs(value - bound),
                }
            )

    anomalies.sort(key=lambda a: a["_deviation"], reverse=True)
    for a in anomalies:
        del a["_deviation"]
    return anomalies[:max_anomalies]


def period_over_period(series: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Compares the most recent period to the one before it."""
    if len(series) < 2:
        return None
    current, previous = series[-1], series[-2]
    delta_pct = None
    if previous["value"] != 0:
        delta_pct = round((current["value"] - previous["value"]) / abs(previous["value"]) * 100, 2)
    return {
        "current_period": current["period"],
        "previous_period": previous["period"],
        "current_value": current["value"],
        "previous_value": previous["value"],
        "delta_pct": delta_pct,
    }


def detect_time_series_spikes(series: list[dict[str, Any]], threshold_std: float = 2.0) -> list[dict[str, Any]]:
    """Flags periods whose value deviates from the linear trend line by more
    than `threshold_std` residual standard deviations — a "sudden spike"
    check distinct from the row-level IQR test above."""
    if len(series) < 4:
        return []

    values = np.array([p["value"] for p in series], dtype=float)
    x = np.arange(len(values))
    slope, intercept = np.polyfit(x, values, 1)
    predicted = slope * x + intercept
    residuals = values - predicted
    std = float(residuals.std())

    # Guard against floating-point noise, not just an exact zero: a
    # near-perfectly-linear series can have residuals on the order of
    # 1e-14 with an equally tiny std, and dividing noise by noise produces
    # "z-scores" that look like real numbers but are meaningless. Treat
    # residual spread below 1e-9 relative to the series' own scale as no
    # real variation at all.
    scale = float(np.abs(values).mean()) or 1.0
    if std / scale < 1e-9:
        return []

    spikes = []
    for i, p in enumerate(series):
        z = residuals[i] / std
        if abs(z) >= threshold_std:
            spikes.append(
                {
                    "period": p["period"],
                    "value": p["value"],
                    "expected": round(float(predicted[i]), 2),
                    "deviation_std": round(float(z), 2),
                    "direction": "above" if z > 0 else "below",
                }
            )
    return spikes


def detect_seasonality(series: list[dict[str, Any]], lag: int = 12) -> dict[str, Any]:
    """Lag-`lag` autocorrelation on the monthly series (default: yearly
    seasonality). Honestly reports insufficient data rather than guessing
    when there isn't at least two full cycles to compare."""
    if len(series) < lag * 2:
        return {"detected": False, "reason": "insufficient_data", "periods_available": len(series), "periods_required": lag * 2}

    values = np.array([p["value"] for p in series], dtype=float)
    a, b = values[:-lag], values[lag:]
    if a.std() == 0 or b.std() == 0:
        return {"detected": False, "reason": "no_variance"}

    corr = float(np.corrcoef(a, b)[0, 1])
    detected = not np.isnan(corr) and abs(corr) >= 0.5
    return {"detected": detected, "lag": lag, "autocorrelation": round(corr, 3)}
