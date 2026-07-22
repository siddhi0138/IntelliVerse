"""V3 backfill: forecast eligibility, automatic model selection, validation metrics.

Rather than assuming one algorithm, this backtests a few honest
candidates — naive carry-forward, linear trend (OLS), and Holt's linear
exponential smoothing — on a held-out tail of the series, and picks
whichever had the lowest validation RMSE. (Prophet and XGBoost were
considered and skipped: Prophet's build toolchain is fragile on Windows
without a C++ compiler, and gradient-boosted trees are overkill for a
handful of monthly points — Holt's method covers the same "trend +
smoothing" ground.)

Below `MIN_PERIODS_FOR_MODEL_SELECTION` there isn't enough data to
backtest honestly, so we fall back to linear trend outright and say so
in the response rather than fabricate a comparison.
"""

from __future__ import annotations

from typing import Any, Callable

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import Holt

MIN_PERIODS_FOR_FORECAST = 3
MIN_PERIODS_FOR_MODEL_SELECTION = 6


def check_forecast_eligibility(
    has_date_column: bool, has_numeric_column: bool, series_length: int
) -> dict[str, Any]:
    if not has_date_column:
        return {"eligible": False, "reason": "No date column was detected in this dataset."}
    if not has_numeric_column:
        return {"eligible": False, "reason": "No numeric column was detected to forecast."}
    if series_length < MIN_PERIODS_FOR_FORECAST:
        return {
            "eligible": False,
            "reason": (
                f"Only {series_length} time period(s) of data — at least "
                f"{MIN_PERIODS_FOR_FORECAST} are needed to fit a trend."
            ),
        }
    return {"eligible": True, "reason": None}


def _naive_forecast(train: np.ndarray, steps: int) -> np.ndarray:
    return np.full(steps, train[-1])


def _linear_forecast(train: np.ndarray, steps: int) -> np.ndarray:
    x = np.arange(len(train))
    slope, intercept = np.polyfit(x, train, 1)
    future_x = np.arange(len(train), len(train) + steps)
    return slope * future_x + intercept


def _holt_forecast(train: np.ndarray, steps: int) -> np.ndarray | None:
    if len(train) < 3 or train.std() == 0:
        return None
    try:
        model = Holt(train, initialization_method="estimated").fit(optimized=True)
        return np.asarray(model.forecast(steps))
    except Exception:
        return None


_CANDIDATES: dict[str, Callable[[np.ndarray, int], np.ndarray | None]] = {
    "naive": _naive_forecast,
    "linear_trend": _linear_forecast,
    "holt_linear_trend": _holt_forecast,
}


def _errors(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float | None]:
    diff = actual - predicted
    rmse = float(np.sqrt(np.mean(diff**2)))
    mae = float(np.mean(np.abs(diff)))
    nonzero = actual != 0
    mape = float(np.mean(np.abs(diff[nonzero] / actual[nonzero])) * 100) if nonzero.any() else None
    return {"rmse": round(rmse, 2), "mae": round(mae, 2), "mape": round(mape, 2) if mape is not None else None}


def select_and_forecast(series: list[dict[str, Any]], periods_ahead: int = 3) -> dict[str, Any]:
    if len(series) < MIN_PERIODS_FOR_FORECAST:
        return {"history": series, "forecast": [], "method": "insufficient_data", "validation": None}

    values = np.array([p["value"] for p in series], dtype=float)
    n = len(values)

    validation: dict[str, Any] | None = None

    if n < MIN_PERIODS_FOR_MODEL_SELECTION:
        chosen_name = "linear_trend"
    else:
        holdout = max(1, min(3, n // 4))
        train, test = values[:-holdout], values[-holdout:]

        scored: list[tuple[str, dict[str, float | None]]] = []
        for name, fn in _CANDIDATES.items():
            pred = fn(train, holdout)
            if pred is None:
                continue
            scored.append((name, _errors(test, pred)))

        scored.sort(key=lambda s: s[1]["rmse"])
        chosen_name = scored[0][0]
        validation = {
            "holdout_periods": holdout,
            "chosen_model": chosen_name,
            "metrics": scored[0][1],
            "all_candidates": [{"model": name, **err} for name, err in scored],
        }

    chosen_fn = _CANDIDATES[chosen_name]
    predicted_future = chosen_fn(values, periods_ahead)
    if predicted_future is None:
        chosen_name = "linear_trend"
        predicted_future = _linear_forecast(values, periods_ahead)

    if chosen_name == "linear_trend":
        x = np.arange(n)
        slope, intercept = np.polyfit(x, values, 1)
        residuals = values - (slope * x + intercept)
        trend = "flat" if abs(slope) < 1e-9 else ("up" if slope > 0 else "down")
    else:
        residuals = np.diff(values, prepend=values[0])
        last_val = values[-1]
        future_val = predicted_future[-1]
        trend = "flat" if future_val == last_val else ("up" if future_val > last_val else "down")

    std = float(residuals.std()) if len(residuals) > 1 else 0.0

    last_period = pd.Period(series[-1]["period"], freq="M")
    forecast_points = []
    for i, val in enumerate(predicted_future, start=1):
        forecast_points.append(
            {
                "period": str(last_period + i),
                "value": round(float(val), 2),
                "lower": round(float(val) - 1.96 * std, 2),
                "upper": round(float(val) + 1.96 * std, 2),
            }
        )

    return {
        "history": series,
        "forecast": forecast_points,
        "method": chosen_name,
        "trend": trend,
        "validation": validation,
    }
