import numpy as np
import pandas as pd

from clustering import cluster_rows
from schema_inference import build_schema


def test_finds_two_well_separated_clusters():
    rng = np.random.default_rng(42)
    cluster_a = rng.normal(loc=10, scale=1, size=(15, 2))
    cluster_b = rng.normal(loc=100, scale=1, size=(15, 2))
    df = pd.DataFrame(np.vstack([cluster_a, cluster_b]), columns=["X", "Y"])

    schema = build_schema(df)
    result = cluster_rows(df, schema)

    assert result is not None
    assert result["k"] == 2
    assert result["silhouette_score"] > 0.8
    assert sum(c["size"] for c in result["clusters"]) == 30


def test_returns_none_below_minimum_rows():
    df = pd.DataFrame({"X": range(5), "Y": range(5)})
    schema = build_schema(df)
    assert cluster_rows(df, schema) is None


def test_returns_none_with_fewer_than_two_numeric_columns(business_df):
    df = business_df[["Region", "Category"]]
    schema = build_schema(df)
    assert cluster_rows(df, schema) is None
