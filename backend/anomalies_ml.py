"""V2/V4 additive: multivariate anomaly detection with consensus + SHAP.

The IQR/Z-score checks in analytics.py look at one column at a time —
they miss a row that's unremarkable in every individual column but
unusual in *combination* (e.g. high revenue with very low order count).
Three methods now run and vote: Isolation Forest (isolates points by
random recursive splits), Local Outlier Factor (density-based — flags
points in sparse neighborhoods), and One-Class SVM (flags points outside
a learned boundary). A row flagged by more than one method is reported
with higher consensus, which is a more honest confidence signal than any
single method's score alone. DBSCAN was in the original ask too but is
still skipped — it needs a distance-scale parameter (`eps`) that's
genuinely dataset-dependent, unlike these three which all have sane
default parameters.

For rows Isolation Forest flags, SHAP's TreeExplainer explains *why* —
which features pushed the anomaly score, and in which direction — instead
of leaving the score as a black box.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler
from sklearn.svm import OneClassSVM

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

    feature_names = [c.name for c in numeric_cols]
    X = frame.to_numpy()
    X_scaled = StandardScaler().fit_transform(X)

    iso = IsolationForest(contamination=contamination, random_state=42)
    iso_labels = iso.fit_predict(X)
    iso_scores = iso.score_samples(X)  # higher = more normal

    lof = LocalOutlierFactor(contamination=contamination)
    lof_labels = lof.fit_predict(X_scaled)

    ocsvm = OneClassSVM(nu=contamination, kernel="rbf", gamma="auto")
    ocsvm_labels = ocsvm.fit_predict(X_scaled)

    try:
        import shap  # lazy: heavy import, only paid for when this actually runs

        explainer = shap.TreeExplainer(iso)
    except Exception:
        explainer = None

    results: list[dict[str, Any]] = []
    for i, idx in enumerate(frame.index):
        detected_by = []
        if iso_labels[i] == -1:
            detected_by.append("isolation_forest")
        if lof_labels[i] == -1:
            detected_by.append("local_outlier_factor")
        if ocsvm_labels[i] == -1:
            detected_by.append("one_class_svm")
        if not detected_by:
            continue

        identifier = str(df.loc[idx, id_column]) if id_column and id_column in df.columns else f"row {idx}"
        contributing = {name: round(float(frame.iloc[i][name]), 2) for name in feature_names}

        top_features = None
        if "isolation_forest" in detected_by and explainer is not None:
            try:
                shap_row = np.asarray(explainer.shap_values(X[i : i + 1]))[0]
                ranked = sorted(zip(feature_names, shap_row), key=lambda kv: abs(kv[1]), reverse=True)
                top_features = [{"feature": f, "impact": round(float(v), 3)} for f, v in ranked[:3]]
            except Exception:
                top_features = None

        results.append(
            {
                "row": identifier,
                "anomaly_score": round(float(-iso_scores[i]), 3),
                "values": contributing,
                "method": "isolation_forest" if "isolation_forest" in detected_by else detected_by[0],
                "detected_by": detected_by,
                "consensus": len(detected_by),
                "top_contributing_features": top_features,
            }
        )

    results.sort(key=lambda a: (a["consensus"], a["anomaly_score"]), reverse=True)
    return results[:max_anomalies]
