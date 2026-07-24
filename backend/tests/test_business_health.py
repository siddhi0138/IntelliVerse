from business_health import compute_business_health
from profiling import DataQualityReport


def test_high_quality_growth_low_risk_scores_well():
    quality = DataQualityReport(score=95.0, duplicate_row_count=0, duplicate_row_pct=0.0)
    forecast = {"trend": "up", "validation": {"metrics": {"mape": 5.0}}}
    period_comparison = {"delta_pct": 15.0}
    result = compute_business_health(quality, forecast, period_comparison, [])

    assert result["components"]["data_quality"] == 95
    assert result["components"]["growth"] > 60
    assert result["components"]["forecast_reliability"] > 90
    assert result["components"]["safety"] == 90
    assert result["overall"] > 70


def test_poor_quality_decline_and_risk_alerts_score_poorly():
    quality = DataQualityReport(score=30.0, duplicate_row_count=10, duplicate_row_pct=20.0)
    forecast = {"trend": "down", "validation": {"metrics": {"mape": 60.0}}}
    period_comparison = {"delta_pct": -25.0}
    alerts = [{"kind": "threshold_crossing"}, {"kind": "decline"}]
    result = compute_business_health(quality, forecast, period_comparison, alerts)

    assert result["components"]["data_quality"] == 30
    assert result["components"]["growth"] < 40
    assert result["components"]["forecast_reliability"] < 50
    assert result["components"]["safety"] < 60
    assert result["overall"] < 50


def test_no_forecast_or_period_comparison_falls_back_to_neutral():
    quality = DataQualityReport(score=80.0, duplicate_row_count=0, duplicate_row_pct=0.0)
    result = compute_business_health(quality, None, None, [])

    assert result["components"]["growth"] == 55
    assert result["components"]["forecast_reliability"] == 50
