"""V3: forecast eligibility, automatic target discovery, model selection,
and validation metrics.

Six candidates are backtested on a held-out tail of each series: naive
carry-forward, linear trend (OLS), Holt's linear exponential smoothing,
Random Forest, XGBoost, and Prophet. Whichever has the lowest validation
RMSE is chosen and refit on the full series. This is a real competition,
not a fixed pick — on short, noisy monthly series the tree models often
lose (they can't extrapolate a trend past the range they were trained on,
a genuine, known limitation, not a bug), and that's exactly the point:
let the backtest decide instead of assuming one algorithm.

Below `MIN_PERIODS_FOR_MODEL_SELECTION` there isn't enough data to
backtest honestly, so this falls back to linear trend outright and says
so rather than run six models on three points.
"""

from __future__ import annotations

import logging
import warnings
from typing import Any, Callable

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score
from statsmodels.tsa.holtwinters import Holt

logging.getLogger("cmdstanpy").setLevel(logging.WARNING)
warnings.filterwarnings("ignore", module="prophet")

MIN_PERIODS_FOR_FORECAST = 3
MIN_PERIODS_FOR_MODEL_SELECTION = 6
MIN_PERIODS_FOR_TARGET_DISCOVERY = 3


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


def discover_forecastable_targets(
    df: pd.DataFrame, schema, date_column: str | None, monthly_series_fn: Callable
) -> list[dict[str, Any]]:
    """Evaluates every numeric column as a potential forecast target,
    rather than silently only ever forecasting the first one."""
    if not date_column:
        return []

    numeric_cols = [c for c in schema if c.type == "numeric"]
    targets: list[dict[str, Any]] = []

    for col in numeric_cols:
        series = monthly_series_fn(df, date_column, col.name)
        n = len(series)
        eligible = n >= MIN_PERIODS_FOR_TARGET_DISCOVERY
        if not eligible:
            confidence = 0.0
            reason = f"Only {n} time period(s) — need at least {MIN_PERIODS_FOR_TARGET_DISCOVERY}."
        elif n >= MIN_PERIODS_FOR_MODEL_SELECTION:
            confidence = 0.9
            reason = None
        else:
            confidence = 0.5
            reason = f"Only {n} time periods — too few to backtest multiple models, will use linear trend."

        targets.append(
            {
                "column": col.name,
                "semantic_label": col.semantic_label,
                "eligible": eligible,
                "confidence": confidence,
                "periods_available": n,
                "reason": reason,
            }
        )

    targets.sort(key=lambda t: t["confidence"], reverse=True)
    return targets


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


def _random_forest_forecast(train: np.ndarray, steps: int) -> np.ndarray | None:
    if len(train) < 4:
        return None
    try:
        x = np.arange(len(train)).reshape(-1, 1)
        model = RandomForestRegressor(n_estimators=200, random_state=42)
        model.fit(x, train)
        future_x = np.arange(len(train), len(train) + steps).reshape(-1, 1)
        return model.predict(future_x)
    except Exception:
        return None


def _xgboost_forecast(train: np.ndarray, steps: int) -> np.ndarray | None:
    if len(train) < 4:
        return None
    try:
        from xgboost import XGBRegressor

        x = np.arange(len(train)).reshape(-1, 1)
        model = XGBRegressor(n_estimators=100, max_depth=3, random_state=42)
        model.fit(x, train)
        future_x = np.arange(len(train), len(train) + steps).reshape(-1, 1)
        return model.predict(future_x)
    except Exception:
        return None


def _prophet_forecast(train_periods: list[str], train_values: np.ndarray, steps: int) -> np.ndarray | None:
    if len(train_values) < 4:
        return None
    try:
        from prophet import Prophet

        ds = pd.to_datetime([f"{p}-01" for p in train_periods])
        history = pd.DataFrame({"ds": ds, "y": train_values})
        model = Prophet(yearly_seasonality=len(train_values) >= 24, daily_seasonality=False, weekly_seasonality=False)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model.fit(history)
        future = model.make_future_dataframe(periods=steps, freq="MS", include_history=False)
        forecast = model.predict(future)
        return forecast["yhat"].to_numpy()
    except Exception:
        return None


def _errors(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float | None]:
    diff = actual - predicted
    rmse = float(np.sqrt(np.mean(diff**2)))
    mae = float(np.mean(np.abs(diff)))
    nonzero = actual != 0
    mape = float(np.mean(np.abs(diff[nonzero] / actual[nonzero])) * 100) if nonzero.any() else None
    r_squared = float(r2_score(actual, predicted)) if len(actual) >= 2 and actual.std() > 0 else None
    return {
        "rmse": round(rmse, 2),
        "mae": round(mae, 2),
        "mape": round(mape, 2) if mape is not None else None,
        "r_squared": round(r_squared, 3) if r_squared is not None else None,
    }


def select_and_forecast(series: list[dict[str, Any]], periods_ahead: int = 3) -> dict[str, Any]:
    if len(series) < MIN_PERIODS_FOR_FORECAST:
        return {"history": series, "forecast": [], "method": "insufficient_data", "validation": None}

    values = np.array([p["value"] for p in series], dtype=float)
    periods = [p["period"] for p in series]
    n = len(values)

    validation: dict[str, Any] | None = None

    if n < MIN_PERIODS_FOR_MODEL_SELECTION:
        chosen_name = "linear_trend"
    else:
        holdout = max(1, min(3, n // 4))
        train, test = values[:-holdout], values[-holdout:]
        train_periods = periods[:-holdout]

        candidates: dict[str, np.ndarray | None] = {
            "naive": _naive_forecast(train, holdout),
            "linear_trend": _linear_forecast(train, holdout),
            "holt_linear_trend": _holt_forecast(train, holdout),
            "random_forest": _random_forest_forecast(train, holdout),
            "xgboost": _xgboost_forecast(train, holdout),
            "prophet": _prophet_forecast(train_periods, train, holdout),
        }

        scored: list[tuple[str, dict[str, float | None]]] = []
        for name, pred in candidates.items():
            if pred is None:
                continue
            scored.append((name, _errors(test, pred)))

        scored.sort(key=lambda s: s[1]["rmse"])
        chosen_name = scored[0][0]
        validation = {
            "holdout_periods": holdout,
            "chosen_model": chosen_name,
            "metrics": scored[0][1],
            "all_candidates": [{"model": name, "selected": name == chosen_name, **err} for name, err in scored],
            "train_period": {"start": train_periods[0], "end": train_periods[-1]},
            "validation_period": {"start": periods[-holdout], "end": periods[-1]},
        }

    forecast_fns: dict[str, Callable[[], np.ndarray | None]] = {
        "naive": lambda: _naive_forecast(values, periods_ahead),
        "linear_trend": lambda: _linear_forecast(values, periods_ahead),
        "holt_linear_trend": lambda: _holt_forecast(values, periods_ahead),
        "random_forest": lambda: _random_forest_forecast(values, periods_ahead),
        "xgboost": lambda: _xgboost_forecast(values, periods_ahead),
        "prophet": lambda: _prophet_forecast(periods, values, periods_ahead),
    }
    predicted_future = forecast_fns[chosen_name]()
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
