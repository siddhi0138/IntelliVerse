from relationships import RootCauseAnalysis, RootCauseDimension
from risk_alerts import generate_risk_alerts


def _forecast(trend: str, mape: float | None = 10.0, history_last: float | None = None) -> dict:
    forecast = {
        "column": "Revenue",
        "trend": trend,
        "forecast": [{"period": "2024-07", "value": 100.0}],
        "validation": {"metrics": {"mape": mape}} if mape is not None else None,
    }
    if history_last is not None:
        forecast["history"] = [{"period": "2024-06", "value": history_last}]
    return forecast


def test_no_alerts_when_forecast_is_missing():
    assert generate_risk_alerts(None, None) == []


def test_no_alerts_when_forecast_has_no_points():
    assert generate_risk_alerts({"trend": "down", "forecast": []}, None) == []


def test_no_alerts_when_trend_is_up():
    alerts = generate_risk_alerts(_forecast("up"), None)
    assert alerts == []


def test_decline_alert_generated_when_trend_is_down():
    alerts = generate_risk_alerts(_forecast("down"), None)
    assert len(alerts) == 1
    assert alerts[0]["kind"] == "decline"
    assert alerts[0]["metric"] == "Revenue"
    assert alerts[0]["confidence_pct"] == 90  # 100 - mape(10)


def test_confidence_pct_is_none_without_validation_metrics():
    alerts = generate_risk_alerts(_forecast("down", mape=None), None)
    assert alerts[0]["confidence_pct"] is None


def test_confidence_pct_floors_at_zero_for_very_high_mape():
    alerts = generate_risk_alerts(_forecast("down", mape=150.0), None)
    assert alerts[0]["confidence_pct"] == 0


def test_primary_driver_comes_from_top_root_cause_dimension():
    root_cause = RootCauseAnalysis(
        metric_column="Revenue",
        metric_label="Revenue",
        dimensions=[
            RootCauseDimension(
                dimension_column="Region",
                dimension_label="Region",
                variance_explained_pct=40.0,
                top_segment="West",
                top_segment_deviation_pct=12.0,
                test_used="anova",
                test_statistic=5.0,
                p_value=0.01,
                significant=True,
            )
        ],
    )
    alerts = generate_risk_alerts(_forecast("down"), root_cause)
    assert alerts[0]["primary_driver"] == "Region"


def test_threshold_crossing_alert_only_fires_for_quantity_labeled_metrics():
    forecast = _forecast("down", history_last=100.0)
    forecast["forecast"] = [{"period": "p1", "value": 50.0}, {"period": "p2", "value": -10.0}]

    no_label = generate_risk_alerts(forecast, None, metric_semantic_label=None)
    assert all(a["kind"] != "threshold_crossing" for a in no_label)

    with_label = generate_risk_alerts(forecast, None, metric_semantic_label="Quantity")
    crossing = [a for a in with_label if a["kind"] == "threshold_crossing"]
    assert len(crossing) == 1
    # crosses zero between period 1 (50) and period 2 (-10): 1 + 50/60
    assert crossing[0]["periods_until_critical"] == round(1 + 50 / 60, 1)


def test_threshold_crossing_not_generated_when_forecast_never_goes_negative():
    forecast = _forecast("down", history_last=100.0)
    forecast["forecast"] = [{"period": "p1", "value": 90.0}, {"period": "p2", "value": 80.0}]
    alerts = generate_risk_alerts(forecast, None, metric_semantic_label="Quantity")
    assert all(a["kind"] != "threshold_crossing" for a in alerts)
