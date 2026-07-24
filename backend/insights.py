"""AI-generated narration over an already-analyzed dataset: dataset summaries, forecast
explanations, and simulation explanations.

Calls out to an OpenAI-compatible endpoint (FreeLLMAPI by default, running
locally). If no provider is configured or the call fails, callers get a
clear reason rather than a 500, since this is a nice-to-have layered on
top of the charts/graph that already render without it.
"""

from __future__ import annotations

import json
import os

import httpx

LLM_BASE_URL = os.environ.get("FREELLMAPI_BASE_URL", "http://localhost:3001/v1")
LLM_API_KEY = os.environ.get("FREELLMAPI_API_KEY", "")
LLM_MODEL = os.environ.get("FREELLMAPI_MODEL", "auto")


def persona_instruction(persona: str | None) -> str:
    """Appended to a system prompt so narration is framed for who's reading it,
    not a generic "business user". The underlying numbers never change —
    only the language, examples, and framing do."""
    if not persona:
        return ""
    return (
        f"\n\nThe reader is a {persona}. Use language, examples, and framing that would make immediate "
        f"sense to someone in that role, without changing what the numbers actually say."
    )


class InsightsUnavailable(Exception):
    pass


async def call_llm_json(system_prompt: str, user_content: str) -> dict:
    if not LLM_API_KEY:
        raise InsightsUnavailable("No FREELLMAPI_API_KEY configured on the backend.")

    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.3,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(
                f"{LLM_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {LLM_API_KEY}"},
                json=payload,
            )
        res.raise_for_status()
    except httpx.HTTPError as exc:
        raise InsightsUnavailable(f"Could not reach LLM router: {type(exc).__name__}: {exc}") from exc

    body = res.json()
    try:
        content = body["choices"][0]["message"]["content"]
        return json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise InsightsUnavailable(f"Router returned an unparseable response: {exc}") from exc


# Observed failure mode (confirmed against real small-model output, not a guess):
# some models ignore "put everything in one `summary` string" and instead
# split the answer into separate keys matching the sub-questions the prompt
# lists — e.g. {"expected": "...", "why": "...", "reliability": "...",
# "limitations": "..."} instead of {"summary": "..."}. Stitch that back into
# one paragraph instead of discarding a perfectly good answer as a failure.
_SUMMARY_FALLBACK_KEYS = ("expected", "why", "reliability", "reliable", "limitations", "assumptions")


def _coerce_summary(parsed: dict) -> str:
    if parsed.get("summary"):
        return parsed["summary"]
    parts = []
    for key in _SUMMARY_FALLBACK_KEYS:
        val = parsed.get(key)
        if not val:
            continue
        parts.append("; ".join(str(v) for v in val) if isinstance(val, list) else str(val))
    return " ".join(parts)


async def _call_llm_for_summary(system_prompt: str, user_content: str) -> dict:
    """Like call_llm_json, but also accepts a response that's missing "summary"
    if it can be reassembled from the fallback keys above."""
    parsed = await call_llm_json(system_prompt, user_content)
    summary = _coerce_summary(parsed)
    if not summary:
        raise InsightsUnavailable("Router returned a response without a usable summary.")
    parsed["summary"] = summary
    return parsed


_SIMULATION_SYSTEM_PROMPT = """You are explaining the output of a statistical scenario \
simulation to a business user. You are given a decision (which metric was changed and by \
how much) and a list of propagated effects on other metrics, each with a projected percent \
change, an R-squared confidence value, and whether the association is positive or negative.

These are historical statistical associations, NOT proven causal effects — say so \
explicitly. Do not invent business mechanisms, causes, or reasoning beyond what the \
statistics show. Only describe what changed and cite the confidence values given.

Respond with strict JSON only, no markdown fences, matching exactly this shape:
{"summary": "2-3 sentences describing the projected outcome, citing the strongest effects and their confidence",
 "assumptions": ["short assumption 1", "short assumption 2"]}"""


def _summarize_simulation_for_prompt(domain: str, simulation: dict) -> str:
    lines = [
        f"Domain guess: {domain}",
        f"Decision: change {simulation['driver_label']} by {simulation['pct_change']}%",
        "Propagated effects (associations, not causal claims):",
    ]
    for e in simulation["effects"]:
        if e["column"] == simulation["driver_column"]:
            continue
        delta = f"{e['delta_pct']}%" if e["delta_pct"] is not None else "n/a"
        lines.append(
            f"- {e['semantic_label']}: projected change {delta}, confidence={e['confidence']} "
            f"(r²={e['r_squared']}), {e['relationship']}"
        )
    return "\n".join(lines)


async def generate_simulation_explanation(domain: str, simulation: dict, persona: str | None = None) -> dict:
    summary = _summarize_simulation_for_prompt(domain, simulation)
    prompt = _SIMULATION_SYSTEM_PROMPT + persona_instruction(persona)
    parsed = await _call_llm_for_summary(prompt, summary)
    return {
        "summary": parsed["summary"],
        "assumptions": parsed.get("assumptions", []),
    }


_DATASET_SUMMARY_SYSTEM_PROMPT = """You write a single concise overview paragraph (4-6 \
sentences) describing an uploaded dataset, using ONLY the computed statistics given — never \
invent facts, time ranges, or business context not present in the data. Mention: what the \
data appears to contain, its size, the data quality score, the most notable quality issue (if \
any), and what kind of analysis the detected columns support (e.g. time-series, segmentation).

Respond with strict JSON only, no markdown fences: {"summary": "the paragraph"}"""


def _summarize_dataset_for_prompt(
    domain: str, row_count: int, column_count: int, schema: list[dict], quality: dict | None
) -> str:
    lines = [
        f"Domain guess: {domain}",
        f"Rows: {row_count}, Columns: {column_count}",
        "Columns: " + ", ".join(f"{c['semantic_label']} ({c['type']})" for c in schema),
    ]
    date_cols = [c for c in schema if c["type"] == "date" and "min_date" in c.get("stats", {})]
    if date_cols:
        d = date_cols[0]["stats"]
        lines.append(f"Date range ({date_cols[0]['semantic_label']}): {d['min_date']} to {d['max_date']}")
    if quality:
        lines.append(
            f"Data quality score: {quality['score']}/100, "
            f"{quality['duplicate_row_count']} duplicate rows, "
            f"{len(quality.get('invalid_values', []))} invalid-value issue(s)."
        )
    return "\n".join(lines)


async def generate_dataset_summary(
    domain: str,
    row_count: int,
    column_count: int,
    schema: list[dict],
    quality: dict | None,
    persona: str | None = None,
) -> str:
    summary = _summarize_dataset_for_prompt(domain, row_count, column_count, schema, quality)
    prompt = _DATASET_SUMMARY_SYSTEM_PROMPT + persona_instruction(persona)
    parsed = await _call_llm_for_summary(prompt, summary)
    return parsed["summary"]


_FORECAST_SYSTEM_PROMPT = """You are explaining a statistical forecast to a business user. \
You are given: the forecasted metric, which model was selected and why (its validation \
metrics vs. the alternatives that were tried), the projected trend, and the prediction \
interval. Explain: what is expected, why the model thinks this (grounded in the metrics \
given, e.g. seasonality captured, trend direction), how reliable it is (cite the actual MAPE/
R-squared), and what its limitations are (e.g. wider intervals further out, small holdout \
size). Never invent a mechanism or business reason not present in the data.

Respond with strict JSON only, no markdown fences:
{"summary": "3-5 sentences: what's expected, why, how reliable, and limitations"}"""


def _summarize_forecast_for_prompt(domain: str, forecast: dict) -> str:
    lines = [f"Domain guess: {domain}", f"Metric: {forecast.get('column', 'primary metric')}"]
    lines.append(f"Trend: {forecast.get('trend')}, method: {forecast.get('method')}")

    validation = forecast.get("validation")
    if validation:
        lines.append(
            f"Selected model: {validation['chosen_model']}, metrics: {validation['metrics']}, "
            f"backtested over {validation['holdout_periods']} held-out period(s)."
        )
        lines.append("All candidates tried: " + ", ".join(f"{c['model']} (rmse={c['rmse']})" for c in validation["all_candidates"]))
        lines.append(f"Training period: {validation['train_period']}, validation period: {validation['validation_period']}")
    else:
        lines.append("Too few periods to backtest multiple models; used linear trend directly.")

    forecast_points = forecast.get("forecast", [])
    if forecast_points:
        first, last = forecast_points[0], forecast_points[-1]
        lines.append(
            f"Next period projected at {first['value']} (range {first['lower']} to {first['upper']}); "
            f"furthest projected period at {last['value']} (range {last['lower']} to {last['upper']})."
        )

    return "\n".join(lines)


async def generate_forecast_explanation(domain: str, forecast: dict, persona: str | None = None) -> str:
    summary = _summarize_forecast_for_prompt(domain, forecast)
    prompt = _FORECAST_SYSTEM_PROMPT + persona_instruction(persona)
    parsed = await _call_llm_for_summary(prompt, summary)
    return parsed["summary"]


_ANOMALY_REASONS_SYSTEM_PROMPT = """You suggest plausible, general business reasons an unusual data point might \
occur. You are given a domain guess, what the column means, its unusual value, and whether it's above or below \
the normal range.

These are speculative starting points for someone to investigate, not confirmed causes — keep each one short \
and concrete, and do not invent specifics (dates, names, events) that aren't in the input.

Respond with strict JSON only, no markdown fences: {"reasons": ["short reason 1", "short reason 2", "short reason 3"]}
Return at most 3 reasons."""


async def generate_anomaly_reasons(
    domain: str, column_label: str, value: float | str, direction: str, persona: str | None = None
) -> list[str]:
    user_content = f"Domain: {domain}\nColumn: {column_label}\nUnusual value: {value} ({direction} the normal range)"
    prompt = _ANOMALY_REASONS_SYSTEM_PROMPT + persona_instruction(persona)
    parsed = await call_llm_json(prompt, user_content)
    reasons = parsed.get("reasons", [])
    if not reasons:
        raise InsightsUnavailable("Router returned no reasons.")
    return reasons
