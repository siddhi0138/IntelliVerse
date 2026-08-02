"""V9: persistent, incremental learning — a model that updates itself with
each new row instead of retraining from scratch every time.

Uses scikit-learn's `partial_fit` (genuine online learning: the model's
weights are nudged by each new observation, not recomputed from the full
history) and persists its state to disk between updates, so the model
really does keep what it learned across restarts and across successive
uploads/streamed batches of the same series.

Evaluation follows the standard online-learning "predict, then learn"
loop: each new row's actual value is scored against the model's current
prediction BEFORE that row is used to update the model. That makes the
resulting accuracy history a genuine out-of-sample measure of how the
model improves as more data arrives, not a fitted-vs-training comparison.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
from sklearn.linear_model import SGDRegressor
from sklearn.preprocessing import StandardScaler

_MODEL_DIR = Path(__file__).parent / "data" / "models"


@dataclass
class OnlineUpdateResult:
    prediction_before_update: float | None
    actual: float
    abs_pct_error: float | None
    n_updates: int


def _safe_key(*parts: str) -> str:
    return "__".join("".join(c if c.isalnum() else "_" for c in p) for p in parts)


class IncrementalMetricModel:
    """One online model per (analysis_id, target_column), persisted to disk
    under backend/data/models/. `x` is just the row's position in the
    series (1, 2, 3, ...) — enough to let a simple online model track a
    trend/level as new rows stream in without needing to know the dataset's
    other columns in advance."""

    def __init__(self, analysis_id: str, target_column: str):
        self.analysis_id = analysis_id
        self.target_column = target_column
        self._path = _MODEL_DIR / f"{_safe_key(analysis_id, target_column)}.joblib"
        self.model: SGDRegressor
        self.scaler: StandardScaler
        self.n_updates: int
        self._load_or_init()

    def _load_or_init(self) -> None:
        if self._path.exists():
            state = joblib.load(self._path)
            self.model = state["model"]
            self.scaler = state["scaler"]
            self.n_updates = state["n_updates"]
        else:
            self.model = SGDRegressor(learning_rate="adaptive", eta0=0.01, random_state=0)
            self.scaler = StandardScaler()
            self.n_updates = 0

    def _save(self) -> None:
        _MODEL_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump({"model": self.model, "scaler": self.scaler, "n_updates": self.n_updates}, self._path)

    def update(self, row_index: float, actual: float) -> OnlineUpdateResult:
        x = np.array([[row_index]], dtype=float)

        if self.n_updates == 0:
            # First row ever for this series: nothing to score a prediction
            # against yet, just seed the scaler and model.
            self.scaler.partial_fit(x)
            self.model.partial_fit(self.scaler.transform(x), [actual])
            self.n_updates = 1
            self._save()
            return OnlineUpdateResult(prediction_before_update=None, actual=actual, abs_pct_error=None, n_updates=1)

        prediction = float(self.model.predict(self.scaler.transform(x))[0])
        abs_pct_error = round(abs(prediction - actual) / abs(actual) * 100, 2) if actual else None

        self.scaler.partial_fit(x)
        self.model.partial_fit(self.scaler.transform(x), [actual])
        self.n_updates += 1
        self._save()

        return OnlineUpdateResult(
            prediction_before_update=round(prediction, 2),
            actual=actual,
            abs_pct_error=abs_pct_error,
            n_updates=self.n_updates,
        )
