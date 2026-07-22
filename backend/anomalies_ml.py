"""V2: multivariate anomaly detection.

The IQR/Z-score checks in analytics.py look at one column at a time —
they miss a row that's unremarkable in every individual column but
unusual in *combination* (e.g. high revenue with very low order count).
Isolation Forest catches that: it isolates points by random recursive
splits, and points that isolate in fewer splits (across all numeric
columns at once) score as more anomalous. DBSCAN was in the original ask
too but is skipped — the spec marks it optional, and it needs a
distance-scale parameter (`eps`) that's genuinely dataset-dependent,
unlike Isolation Forest's `contamination` which has a sane default.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from schema_inference import ColumnSchema

MIN_ROWS = 15
MIN_NUMERIC_COLUMNS = 2


def _coerce_numeric(df: pd.DataFrame, col: str) -> pd.Series:
    series = df[col]
    if series.dtype == object:
        return pd.to_numeric(series.astype(str).str.replace(r"[,$%]", "", regex=True), errors="coerce")
    return pd.to_numeric(series, errors="coerce")


def detect_multivariate_anomalies(
    df: pd.DataFrame,
    schema: list[ColumnSchema],
    id_column: str | None = None,
    contamination: float = 0.05,
    max_anomalies: int = 5,
) -> list[dict[str, Any]]:
    numeric_cols = [c for c in schema if c.type == "numeric"]
    if len(df) < MIN_ROWS or len(numeric_cols) < MIN_NUMERIC_COLUMNS:
        return []

    frame = pd.DataFrame({c.name: _coerce_numeric(df, c.name) for c in numeric_cols}).dropna()
    if len(frame) < MIN_ROWS:
        return []

    model = IsolationForest(contamination=contamination, random_state=42)
    labels = model.fit_predict(frame)
    scores = model.score_samples(frame)  # higher = more normal

    results: list[dict[str, Any]] = []
    for idx in frame.index[labels == -1]:
        identifier = str(df.loc[idx, id_column]) if id_column and id_column in df.columns else f"row {idx}"
        contributing = {c.name: round(float(frame.loc[idx, c.name]), 2) for c in numeric_cols}
        results.append(
            {
                "row": identifier,
                "anomaly_score": round(float(-scores[frame.index.get_loc(idx)]), 3),
                "values": contributing,
                "method": "isolation_forest",
            }
        )

    results.sort(key=lambda a: a["anomaly_score"], reverse=True)
    return results[:max_anomalies]
