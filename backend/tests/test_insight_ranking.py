from insight_ranking import build_ranked_findings
from relationships import CategoricalAssociation, NumericCorrelation, RootCauseAnalysis, RootCauseDimension


def _correlation(r=0.5, significant=False) -> NumericCorrelation:
    return NumericCorrelation(
        column_a="Revenue",
        column_b="Profit",
        label_a="Revenue",
        label_b="Profit",
        r=r,
        p_value=0.5,
        method="pearson",
        significant=significant,
        strength="moderate",
        direction="positive",
    )


def _association(cramers_v=0.4, significant=False) -> CategoricalAssociation:
    return CategoricalAssociation(
        column_a="Region",
        column_b="Category",
        label_a="Region",
        label_b="Category",
        cramers_v=cramers_v,
        p_value=0.5,
        significant=significant,
        strength="moderate",
    )


def test_empty_inputs_produce_no_findings():
    assert build_ranked_findings([], [], None, []) == []


def test_significant_correlation_outranks_a_similar_insignificant_one():
    weak = _correlation(r=0.5, significant=False)
    strong = _correlation(r=0.5, significant=True)
    ranked = build_ranked_findings([weak, strong], [], None, [])
    assert ranked[0]["evidence"]["significant"] is True


def test_higher_magnitude_correlation_ranks_above_lower_magnitude():
    low = _correlation(r=0.3)
    high = _correlation(r=0.9)
    ranked = build_ranked_findings([low, high], [], None, [])
    assert ranked[0]["evidence"]["r"] == 0.9
    assert ranked[1]["evidence"]["r"] == 0.3


def test_association_headline_includes_both_labels_and_cramers_v():
    ranked = build_ranked_findings([], [_association(cramers_v=0.6)], None, [])
    assert ranked[0]["kind"] == "association"
    assert "Region" in ranked[0]["headline"]
    assert "Category" in ranked[0]["headline"]
    assert "0.6" in ranked[0]["headline"]


def test_root_cause_dimension_scored_relative_to_the_strongest_dimension():
    root_cause = RootCauseAnalysis(
        metric_column="Revenue",
        metric_label="Revenue",
        dimensions=[
            RootCauseDimension(
                dimension_column="Region",
                dimension_label="Region",
                variance_explained_pct=80.0,
                top_segment="West",
                top_segment_deviation_pct=10.0,
                test_used="anova",
                test_statistic=5.0,
                p_value=0.01,
                significant=True,
            ),
            RootCauseDimension(
                dimension_column="Category",
                dimension_label="Category",
                variance_explained_pct=20.0,
                top_segment="Electronics",
                top_segment_deviation_pct=5.0,
                test_used="anova",
                test_statistic=2.0,
                p_value=0.2,
                significant=False,
            ),
        ],
    )
    ranked = build_ranked_findings([], [], root_cause, [])
    assert ranked[0]["evidence"]["variance_explained_pct"] == 80.0
    assert ranked[1]["evidence"]["variance_explained_pct"] == 20.0


def test_anomalies_preserve_their_incoming_order_via_decaying_score():
    anomalies = [
        {"semantic_label": "Revenue", "value": 500, "direction": "above", "method": "iqr"},
        {"semantic_label": "Orders", "value": 2, "direction": "below", "method": "iqr"},
    ]
    ranked = build_ranked_findings([], [], None, anomalies)
    assert [r["kind"] for r in ranked] == ["anomaly", "anomaly"]
    assert ranked[0]["headline"].startswith("Revenue")
    assert ranked[1]["headline"].startswith("Orders")
    assert ranked[0]["score"] > ranked[1]["score"]


def test_max_findings_caps_the_result_length():
    correlations = [_correlation(r=0.1 * i) for i in range(1, 15)]
    ranked = build_ranked_findings(correlations, [], None, [], max_findings=5)
    assert len(ranked) == 5


def test_mixed_kinds_are_merged_and_sorted_by_score_together():
    high_corr = _correlation(r=0.95, significant=True)
    low_assoc = _association(cramers_v=0.05, significant=False)
    ranked = build_ranked_findings([high_corr], [low_assoc], None, [])
    assert ranked[0]["kind"] == "correlation"
    assert ranked[1]["kind"] == "association"
