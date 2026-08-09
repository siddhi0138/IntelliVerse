from insight_timeline import build_insight_timeline


def test_empty_series_returns_empty_timeline():
    assert build_insight_timeline([], []) == []


def test_quiet_period_gets_no_entry():
    series = [{"period": "2024-01", "value": 100}, {"period": "2024-02", "value": 105}]
    assert build_insight_timeline(series, []) == []


def test_notable_swing_generates_a_note():
    series = [{"period": "2024-01", "value": 100}, {"period": "2024-02", "value": 130}]
    timeline = build_insight_timeline(series, [])
    assert len(timeline) == 1
    assert timeline[0]["period"] == "2024-02"
    assert "increased 30.0%" in timeline[0]["notes"][0]


def test_notable_decline_says_decreased():
    series = [{"period": "2024-01", "value": 100}, {"period": "2024-02", "value": 70}]
    timeline = build_insight_timeline(series, [])
    assert "decreased 30.0%" in timeline[0]["notes"][0]


def test_swing_below_threshold_is_not_notable():
    series = [{"period": "2024-01", "value": 100}, {"period": "2024-02", "value": 110}]  # 10% < 15%
    assert build_insight_timeline(series, []) == []


def test_spike_produces_an_anomaly_note_even_without_a_notable_swing():
    series = [{"period": "2024-01", "value": 100}, {"period": "2024-02", "value": 103}]
    spikes = [{"period": "2024-02", "direction": "above", "deviation_std": 2.5}]
    timeline = build_insight_timeline(series, spikes)
    assert len(timeline) == 1
    assert "2.5 sigma" in timeline[0]["notes"][0]
    assert "above" in timeline[0]["notes"][0]


def test_period_can_have_both_a_spike_note_and_a_swing_note():
    series = [{"period": "2024-01", "value": 100}, {"period": "2024-02", "value": 150}]
    spikes = [{"period": "2024-02", "direction": "above", "deviation_std": 3.0}]
    timeline = build_insight_timeline(series, spikes)
    assert len(timeline[0]["notes"]) == 2


def test_first_period_never_gets_a_swing_note_since_theres_no_prior_value():
    series = [{"period": "2024-01", "value": 1000}]
    assert build_insight_timeline(series, []) == []


def test_zero_previous_value_does_not_crash_on_divide_by_zero():
    series = [{"period": "2024-01", "value": 0}, {"period": "2024-02", "value": 50}]
    # Should not raise, and since prev_value == 0 the delta-pct branch is
    # skipped entirely (no meaningful percent change from zero).
    assert build_insight_timeline(series, []) == []
