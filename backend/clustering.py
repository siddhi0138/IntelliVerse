"""V2/V4 additive: KMeans segmentation.

Clusters rows into K segments using their numeric columns (standardized
first, since KMeans is distance-based and columns can be on very
different scales). K is chosen automatically via silhouette score across
a small candidate range rather than assumed — a genuinely different
dataset gets a genuinely different K, and a dataset with no real cluster
structure honestly returns nothing rather than forcing a split.
"""

from __future__ import annotations

from typing import Any

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

from schema_inference import ColumnSchema

MIN_ROWS = 15
MIN_NUMERIC_COLUMNS = 2
MAX_K = 6


def _coerce_numeric(df: pd.DataFrame, col: str) -> pd.Series:
    series = df[col]
    if series.dtype == object:
        return pd.to_numeric(series.astype(str).str.replace(r"[,$%]", "", regex=True), errors="coerce")
    return pd.to_numeric(series, errors="coerce")


def cluster_rows(df: pd.DataFrame, schema: list[ColumnSchema], id_column: str | None = None) -> dict[str, Any] | None:
    numeric_cols = [c for c in schema if c.type == "numeric"]
    if len(df) < MIN_ROWS or len(numeric_cols) < MIN_NUMERIC_COLUMNS:
        return None

    feature_names = [c.name for c in numeric_cols]
    frame = pd.DataFrame({name: _coerce_numeric(df, name) for name in feature_names}).dropna()
    if len(frame) < MIN_ROWS:
        return None

    X = StandardScaler().fit_transform(frame.to_numpy())
    max_k = min(MAX_K, len(frame) // 5)
    if max_k < 2:
        return None

    best_k, best_score, best_labels = None, -1.0, None
    for k in range(2, max_k + 1):
        labels = KMeans(n_clusters=k, n_init=10, random_state=42).fit_predict(X)
        if len(set(labels)) < 2:
            continue
        score = silhouette_score(X, labels)
        if score > best_score:
            best_k, best_score, best_labels = k, score, labels

    if best_labels is None:
        return None

    frame = frame.copy()
    frame["_cluster"] = best_labels
    if id_column and id_column in df.columns:
        frame["_id"] = df.loc[frame.index, id_column].astype(str)

    clusters = []
    for cluster_id in sorted(set(best_labels)):
        subset = frame[frame["_cluster"] == cluster_id]
        profile = {name: round(float(subset[name].mean()), 2) for name in feature_names}
        sample_ids = subset["_id"].head(5).tolist() if "_id" in subset else []
        clusters.append(
            {
                "cluster_id": int(cluster_id),
                "size": int(len(subset)),
                "profile": profile,
                "sample_ids": sample_ids,
            }
        )

    return {"k": best_k, "silhouette_score": round(float(best_score), 3), "clusters": clusters}
