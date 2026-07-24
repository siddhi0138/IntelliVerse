import pandas as pd

from profiling import build_quality_report, detect_invalid_values
from schema_inference import ColumnSchema, build_schema


def test_detects_duplicate_row(dirty_df):
    schema = build_schema(dirty_df)
    report = build_quality_report(dirty_df, schema)
    assert report.duplicate_row_count == 1
    assert report.duplicate_row_pct == 10.0


def test_detects_negative_quantity(dirty_df):
    schema = build_schema(dirty_df)
    report = build_quality_report(dirty_df, schema)
    quantity_issues = [i for i in report.invalid_values if i.column == "Quantity"]
    assert len(quantity_issues) == 1
    assert quantity_issues[0].count == 1
    assert "-3" in quantity_issues[0].examples


def test_detects_inconsistent_casing(dirty_df):
    schema = build_schema(dirty_df)
    report = build_quality_report(dirty_df, schema)
    region_issues = [i for i in report.invalid_values if i.column == "Region"]
    assert len(region_issues) == 1


def test_clean_data_scores_100(business_df):
    schema = build_schema(business_df)
    report = build_quality_report(business_df, schema)
    assert report.score == 100.0
    assert report.duplicate_row_count == 0
    assert report.invalid_values == []


def test_dirty_data_scores_lower_than_clean(business_df, dirty_df):
    clean_report = build_quality_report(business_df, build_schema(business_df))
    dirty_report = build_quality_report(dirty_df, build_schema(dirty_df))
    assert dirty_report.score < clean_report.score


def test_inconsistent_casing_count_is_affected_rows_not_variant_count():
    """count must reflect every row with an inconsistent-casing value, not
    just the number of distinct spelling variants — a repeated variant
    (e.g. 5 rows spelled "usa") must not be undercounted as 1."""
    df = pd.DataFrame({"Region": ["USA"] * 3 + ["usa"] * 5 + ["Usa"] * 2 + ["Canada"] * 10})
    schema = [ColumnSchema(name="Region", type="categorical", semantic_label="Region")]
    issues = detect_invalid_values(df, schema)
    assert len(issues) == 1
    assert issues[0].count == 10


def test_missing_values_generate_recommendation(dirty_df):
    schema = build_schema(dirty_df)
    report = build_quality_report(dirty_df, schema)
    amount_recs = [r for r in report.recommendations if r.column == "Amount"]
    assert len(amount_recs) == 1
    assert "imputation" in amount_recs[0].recommendation.lower()
