"""v3: anomaly detection and forecasting.

Both are deliberately simple, explainable statistics rather than trained
models — an IQR outlier test per numeric column, and an ordinary-least-
-squares linear trend for forecasting with a residual-based uncertainty
band. Good enough to be genuinely useful on small/medium tables, and the
result shape (a point forecast + lower/upper bounds) is the same shape a
fancier model (Prophet, a real ARIMA fit) would produce later without
touching the API or frontend.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from schema_inference import ColumnSchema


def _coerce_numeric(df: pd.DataFrame, col: str) -> pd.Series:
    series = df[col]
    if series.dtype == object:
        return pd.to_numeric(series.astype(str).str.replace(r"[,$%]", "", regex=True), errors="coerce")
    return pd.to_numeric(series, errors="coerce")


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

        q1, q3 = valid.quantile(0.25), valid.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue

        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
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
                    "bounds": {"lower": float(lower_bound), "upper": float(upper_bound)},
                    "_deviation": abs(value - bound),
                }
            )

    anomalies.sort(key=lambda a: a["_deviation"], reverse=True)
    for a in anomalies:
        del a["_deviation"]
    return anomalies[:max_anomalies]


def forecast_next_periods(series: list[dict[str, Any]], periods_ahead: int = 3) -> dict[str, Any]:
    if len(series) < 3:
        return {"history": series, "forecast": [], "method": "insufficient_data"}

    values = np.array([p["value"] for p in series], dtype=float)
    x = np.arange(len(values))
    slope, intercept = np.polyfit(x, values, 1)
    predicted = slope * x + intercept
    residuals = values - predicted
    std = float(residuals.std()) if len(residuals) > 1 else 0.0

    last_period = pd.Period(series[-1]["period"], freq="M")
    forecast = []
    for i in range(1, periods_ahead + 1):
        future_x = len(values) - 1 + i
        predicted_value = float(slope * future_x + intercept)
        forecast.append(
            {
                "period": str(last_period + i),
                "value": round(predicted_value, 2),
                "lower": round(predicted_value - 1.96 * std, 2),
                "upper": round(predicted_value + 1.96 * std, 2),
            }
        )

    trend = "flat"
    if abs(slope) > 1e-9:
        trend = "up" if slope > 0 else "down"

    return {"history": series, "forecast": forecast, "method": "linear_trend", "trend": trend}
