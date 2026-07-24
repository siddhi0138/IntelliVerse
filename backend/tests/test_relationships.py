import numpy as np
import pandas as pd

from relationships import categorical_associations, numeric_correlations, root_cause_breakdown
from schema_inference import ColumnSchema, build_schema


def test_finds_strong_positive_correlation(business_df):
    schema = build_schema(business_df)
    correlations = numeric_correlations(business_df, schema)
    revenue_profit = next(
        c for c in correlations if {c.column_a, c.column_b} == {"Revenue", "Profit"}
    )
    assert revenue_profit.r > 0.9
    assert revenue_profit.direction == "positive"
    assert revenue_profit.significant is True


def test_root_cause_finds_category_and_region(business_df):
    schema = build_schema(business_df)
    result = root_cause_breakdown(business_df, schema, "Revenue")
    assert result is not None
    dimension_columns = {d.dimension_column for d in result.dimensions}
    assert "Category" in dimension_columns or "Region" in dimension_columns
    for d in result.dimensions:
        assert 0 <= d.variance_explained_pct <= 100
        assert d.test_used in ("anova", "kruskal_wallis")


def test_root_cause_returns_none_for_unknown_metric(business_df):
    schema = build_schema(business_df)
    assert root_cause_breakdown(business_df, schema, "NoSuchColumn") is None


def test_categorical_associations_below_threshold_are_excluded(business_df):
    schema = build_schema(business_df)
    associations = categorical_associations(business_df, schema, min_v=0.1)
    for a in associations:
        assert a.cramers_v >= 0.1


def test_root_cause_excludes_tiny_group_from_variance_and_top_segment():
    """A group too small for the significance test (below min_group_rows) must
    also be excluded from variance_explained_pct and top_segment — not just
    from the ANOVA/Kruskal call — or a single tiny noisy group can dominate
    both, even though it was just ruled too small to trust."""
    rng = np.random.default_rng(0)
    group_a = rng.normal(10, 1, 40)
    group_b = rng.normal(20, 1, 40)
    group_c = np.array([1000.0, -1000.0])  # 2 rows, below default min_group_rows=3

    df = pd.DataFrame(
        {
            "Region": ["A"] * 40 + ["B"] * 40 + ["C"] * 2,
            "Metric": np.concatenate([group_a, group_b, group_c]),
        }
    )
    schema = [
        ColumnSchema(name="Region", type="categorical", semantic_label="Region"),
        ColumnSchema(name="Metric", type="numeric", semantic_label="Metric"),
    ]

    result = root_cause_breakdown(df, schema, "Metric")
    assert result is not None
    dim = next(d for d in result.dimensions if d.dimension_column == "Region")

    # A and B are cleanly separated (means 10 vs 20, std 1) — a real analyst
    # would expect variance explained close to 100%, and the top segment to
    # be A or B, never the excluded 2-row group C.
    assert dim.variance_explained_pct > 80
    assert dim.top_segment in ("A", "B")
