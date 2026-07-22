"""V2 backfill: natural-language analytics.

Two-step, compute-then-narrate pipeline. The model never analyzes the
data directly:

1. A classification call maps the free-text question to one of a fixed
   set of intents the backend can actually compute, and to real column
   names from the given schema — if it names a column that doesn't
   exist, we discard it rather than trust it.
2. The backend runs the matching deterministic computation (reusing the
   same functions v2/v3 already built: correlations, root cause,
   period-over-period, monthly series).
3. A second call narrates ONLY that computed result. It is explicitly
   told to say so if the computed result doesn't answer the question,
   rather than filling the gap with invented reasoning.
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from analytics import period_over_period
from insights import call_llm_json
from relationships import numeric_correlations, root_cause_breakdown
from schema_inference import ColumnSchema, monthly_series

_INTENT_SYSTEM_PROMPT = """You classify a user's analytics question into one of a fixed set of \
supported intents, and identify which columns (by exact name) it refers to, from the schema given.

Supported intents:
- "trend": asking about growth/decline/direction of a metric over time
- "compare_periods": asking how a metric changed recently vs before
- "top_category": asking what the top/most common category or segment is
- "correlation": asking how two metrics relate to each other
- "root_cause": asking WHY a metric changed, or which dimension explains a change
- "summary": general "tell me about this data" question, or anything not covered above

Respond with strict JSON only, no markdown fences:
{"intent": "trend|compare_periods|top_category|correlation|root_cause|summary",
 "metric_column": "<exact column name or null>",
 "dimension_column": "<exact column name or null>",
 "other_column": "<exact column name or null>"}

Only use column names that appear in the schema you are given, character-for-character. If unsure, use null."""


def _schema_listing(schema: list[ColumnSchema]) -> str:
    return "\n".join(f"- {c.name} ({c.semantic_label}, {c.type})" for c in schema)


async def _classify_intent(question: str, schema: list[ColumnSchema]) -> dict[str, Any]:
    user_content = f"Available columns:\n{_schema_listing(schema)}\n\nQuestion: {question}"
    return await call_llm_json(_INTENT_SYSTEM_PROMPT, user_content)


def _valid_column(name: Any, schema: list[ColumnSchema]) -> str | None:
    if isinstance(name, str) and any(c.name == name for c in schema):
        return name
    return None


def _compute_answer(
    df: pd.DataFrame,
    schema: list[ColumnSchema],
    domain: str,
    intent: str,
    metric_column: str | None,
    dimension_column: str | None,
    other_column: str | None,
    primary_metric: str | None,
) -> dict[str, Any]:
    date_cols = [c for c in schema if c.type == "date"]
    numeric_cols = [c for c in schema if c.type == "numeric"]
    metric_column = metric_column or primary_metric or (numeric_cols[0].name if numeric_cols else None)

    if intent in ("trend", "compare_periods") and metric_column and date_cols:
        series = monthly_series(df, date_cols[0].name, metric_column)
        if intent == "trend":
            return {"type": "trend", "metric": metric_column, "series": series}
        pop = period_over_period(series)
        return {"type": "compare_periods", "metric": metric_column, "comparison": pop}

    if intent == "top_category":
        col = next((c for c in schema if c.name == dimension_column), None) or next(
            (c for c in schema if c.type == "categorical"), None
        )
        if col:
            return {"type": "top_category", "column": col.semantic_label, "top_values": col.stats.get("top_values", [])}

    if intent == "correlation":
        correlations = numeric_correlations(df, schema)
        if metric_column and other_column:
            filtered = [c for c in correlations if {c.column_a, c.column_b} == {metric_column, other_column}]
            correlations = filtered or correlations
        return {
            "type": "correlation",
            "correlations": [
                {"a": c.label_a, "b": c.label_b, "r": c.r, "strength": c.strength, "direction": c.direction}
                for c in correlations[:5]
            ],
        }

    if intent == "root_cause" and metric_column:
        result = root_cause_breakdown(df, schema, metric_column)
        if result:
            return {
                "type": "root_cause",
                "metric": result.metric_label,
                "dimensions": [
                    {
                        "dimension": d.dimension_label,
                        "variance_explained_pct": d.variance_explained_pct,
                        "top_segment": d.top_segment,
                    }
                    for d in result.dimensions
                ],
                "note": result.note,
            }

    return {
        "type": "summary",
        "domain": domain,
        "row_count": len(df),
        "column_count": len(df.columns),
        "columns": [{"label": c.semantic_label, "type": c.type} for c in schema],
    }


_NARRATION_SYSTEM_PROMPT = """You answer a user's analytics question using ONLY the computed \
result JSON provided — never invent numbers, trends, or reasoning beyond what's given. If the \
computed result doesn't actually answer the question (e.g. it fell back to a general summary), \
say so honestly and describe what IS available instead.

Respond with strict JSON only, no markdown fences: {"answer": "2-4 sentence answer"}"""


async def answer_question(
    df: pd.DataFrame,
    schema: list[ColumnSchema],
    domain: str,
    question: str,
    primary_metric: str | None,
) -> dict[str, Any]:
    parsed_intent = await _classify_intent(question, schema)
    intent = parsed_intent.get("intent", "summary")
    metric_column = _valid_column(parsed_intent.get("metric_column"), schema)
    dimension_column = _valid_column(parsed_intent.get("dimension_column"), schema)
    other_column = _valid_column(parsed_intent.get("other_column"), schema)

    computed = _compute_answer(df, schema, domain, intent, metric_column, dimension_column, other_column, primary_metric)

    narration_input = f"Question: {question}\n\nComputed result:\n{computed}"
    narrated = await call_llm_json(_NARRATION_SYSTEM_PROMPT, narration_input)

    return {
        "intent": intent,
        "computed": computed,
        "answer": narrated.get("answer", ""),
    }
