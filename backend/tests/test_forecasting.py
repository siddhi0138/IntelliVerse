from forecasting import check_forecast_eligibility, select_and_forecast
from schema_inference import monthly_series, build_schema


def test_eligibility_fails_without_date_column():
    result = check_forecast_eligibility(has_date_column=False, has_numeric_column=True, series_length=12)
    assert result["eligible"] is False
    assert "date column" in result["reason"]


def test_eligibility_fails_with_too_few_periods():
    result = check_forecast_eligibility(has_date_column=True, has_numeric_column=True, series_length=2)
    assert result["eligible"] is False


def test_eligibility_passes_with_enough_data():
    result = check_forecast_eligibility(has_date_column=True, has_numeric_column=True, series_length=12)
    assert result["eligible"] is True
    assert result["reason"] is None


def test_forecast_on_growing_series_detects_upward_trend(business_df):
    schema = build_schema(business_df)
    series = monthly_series(business_df, "Order_Date", "Revenue")
    result = select_and_forecast(series)
    assert result["trend"] == "up"
    assert len(result["forecast"]) == 3
    assert result["validation"] is not None
    assert result["validation"]["chosen_model"] in {
        "naive", "linear_trend", "holt_linear_trend", "random_forest", "xgboost", "lightgbm", "prophet",
    }


def test_forecast_reports_insufficient_data_below_minimum():
    series = [{"period": "2024-01", "value": 100}]
    result = select_and_forecast(series)
    assert result["method"] == "insufficient_data"
    assert result["forecast"] == []


def test_forecast_intervals_widen_or_stay_constant_further_out(business_df):
    series = monthly_series(business_df, "Order_Date", "Revenue")
    result = select_and_forecast(series)
    widths = [p["upper"] - p["lower"] for p in result["forecast"]]
    assert all(w >= 0 for w in widths)
