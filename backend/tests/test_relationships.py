from relationships import categorical_associations, numeric_correlations, root_cause_breakdown
from schema_inference import build_schema


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
