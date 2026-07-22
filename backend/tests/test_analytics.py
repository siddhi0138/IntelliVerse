import pandas as pd

from analytics import detect_anomalies, detect_seasonality, detect_time_series_spikes, period_over_period
from schema_inference import build_schema


def test_detect_anomalies_flags_a_genuine_statistical_outlier():
    # detect_anomalies is a *statistical* check (IQR/Z-score), deliberately
    # distinct from profiling.py's business-rule check (a negative Quantity
    # is always flagged there regardless of how extreme it is statistically).
    # This needs a value that's actually far outside the column's own spread.
    df = pd.DataFrame({"OrderID": [f"O{i}" for i in range(10)], "Amount": [100, 105, 98, 102, 97, 101, 99, 103, 96, 5000]})
    schema = build_schema(df)
    anomalies = detect_anomalies(df, schema, id_column="OrderID")
    amount_anomalies = [a for a in anomalies if a["column"] == "Amount"]
    assert len(amount_anomalies) == 1
    assert amount_anomalies[0]["direction"] == "above"
    assert amount_anomalies[0]["value"] == 5000


def test_detect_anomalies_does_not_flag_a_mild_deviation_within_normal_spread(dirty_df):
    # -3 is unusual for a Quantity column, but not statistically extreme
    # relative to this small, higher-variance sample — profiling.py's
    # business-rule check (tested separately) is what catches this, not
    # the general-purpose statistical check.
    schema = build_schema(dirty_df)
    anomalies = detect_anomalies(dirty_df, schema, id_column="Order_ID")
    assert not any(a["column"] == "Quantity" for a in anomalies)


def test_period_over_period_computes_delta():
    series = [{"period": "2024-01", "value": 100}, {"period": "2024-02", "value": 120}]
    result = period_over_period(series)
    assert result["delta_pct"] == 20.0
    assert result["current_period"] == "2024-02"


def test_period_over_period_needs_at_least_two_points():
    assert period_over_period([{"period": "2024-01", "value": 100}]) is None


def test_time_series_spikes_flags_large_deviation():
    # a steady trend with one huge spike in the middle
    series = [{"period": f"2024-{i:02d}", "value": 100 + i * 10} for i in range(1, 7)]
    series[3]["value"] = 5000  # obvious spike
    spikes = detect_time_series_spikes(series)
    assert any(s["period"] == series[3]["period"] for s in spikes)


def test_time_series_spikes_empty_for_smooth_trend():
    series = [{"period": f"2024-{i:02d}", "value": 100 + i * 10} for i in range(1, 7)]
    assert detect_time_series_spikes(series) == []


def test_seasonality_reports_insufficient_data_for_short_series():
    series = [{"period": f"2024-{i:02d}", "value": 100} for i in range(1, 7)]
    result = detect_seasonality(series, lag=12)
    assert result["detected"] is False
    assert result["reason"] == "insufficient_data"
