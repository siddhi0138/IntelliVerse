from schema_inference import build_schema
from simulation import CorrelationRegressionEngine, build_decision_actions


def test_decision_actions_only_for_numeric_columns(business_df):
    schema = build_schema(business_df)
    actions = build_decision_actions(schema)
    action_columns = {a["column"] for a in actions}
    assert action_columns == {"Revenue", "Orders", "Customers", "Profit"}


def test_no_decisions_when_no_numeric_columns():
    import pandas as pd

    df = pd.DataFrame({"Name": ["a", "b", "c"]})
    schema = build_schema(df)
    assert build_decision_actions(schema) == []


def test_propagate_direct_change_matches_pct(business_df):
    schema = build_schema(business_df)
    engine = CorrelationRegressionEngine()
    result = engine.propagate(business_df, schema, "Revenue", 20.0)

    driver_effect = next(e for e in result.effects if e.column == "Revenue")
    assert driver_effect.delta_pct == 20.0
    assert driver_effect.relationship == "direct change"
    assert driver_effect.confidence == "high"


def test_propagate_finds_strong_profit_association(business_df):
    schema = build_schema(business_df)
    engine = CorrelationRegressionEngine()
    result = engine.propagate(business_df, schema, "Revenue", 20.0)

    profit_effect = next(e for e in result.effects if e.column == "Profit")
    assert profit_effect.r_squared > 0.9
    assert profit_effect.relationship == "positive association"
    assert profit_effect.delta_pct > 0


def test_propagate_always_attaches_association_disclaimer(business_df):
    schema = build_schema(business_df)
    engine = CorrelationRegressionEngine()
    result = engine.propagate(business_df, schema, "Revenue", -10.0)
    assert "not" in result.note.lower()
    assert "association" in result.note.lower()
