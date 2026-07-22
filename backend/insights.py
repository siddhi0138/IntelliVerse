"""AI-generated insights and recommendations over an already-analyzed dataset.

Calls out to an OpenAI-compatible endpoint (FreeLLMAPI by default, running
locally) with a compact statistical summary of the dataset — column stats,
detected anomalies, forecast trend — never raw rows — and asks for a short
list of structured insights plus recommended actions. If no provider is
configured or the call fails, callers get a clear reason rather than a
500, since this is a nice-to-have layered on top of the charts/graph that
already render without it.
"""

from __future__ import annotations

import json
import os

import httpx

LLM_BASE_URL = os.environ.get("FREELLMAPI_BASE_URL", "http://localhost:3001/v1")
LLM_API_KEY = os.environ.get("FREELLMAPI_API_KEY", "")
LLM_MODEL = os.environ.get("FREELLMAPI_MODEL", "auto")

_SYSTEM_PROMPT = """You are a senior data analyst. You are given a compact statistical \
summary of a dataset (column types, inferred meanings, aggregate stats, detected \
statistical outliers, and a forecast trend) — not the raw rows. Identify the most useful, \
concrete insights a business user would want to know, and propose concrete recommended \
actions grounded in the anomalies and forecast trend when they are present.

Respond with strict JSON only, no markdown fences, matching exactly this shape:
{"insights": [{"title": "short headline", "description": "1-2 sentences", "confidence": "high|medium|low"}],
 "recommendations": [{"title": "short headline", "action": "one concrete action to take", "rationale": "why, tied to the data"}]}

Return at most 5 insights and at most 4 recommendations. If the data is too sparse to say \
anything meaningful, return empty lists for either."""


def _summarize_for_prompt(
    domain: str,
    row_count: int,
    schema: list[dict],
    anomalies: list[dict],
    forecast: dict | None,
) -> str:
    lines = [f"Domain guess: {domain}", f"Row count: {row_count}", "Columns:"]
    for col in schema:
        stats = col.get("stats", {})
        stat_bits = []
        if "sum" in stats:
            stat_bits.append(f"sum={stats['sum']}")
        if "mean" in stats:
            stat_bits.append(f"mean={round(stats['mean'], 2)}")
        if "min" in stats and "max" in stats:
            stat_bits.append(f"range=[{stats['min']}, {stats['max']}]")
        if "top_values" in stats:
            top = ", ".join(f"{v['value']} ({v['count']})" for v in stats["top_values"][:5])
            stat_bits.append(f"top_values=[{top}]")
        if "min_date" in stats:
            stat_bits.append(f"date_range=[{stats['min_date']} to {stats['max_date']}]")
        stat_bits.append(f"nulls={stats.get('null_count', 0)}")
        lines.append(f"- {col['semantic_label']} ({col['name']}, {col['type']}): {', '.join(stat_bits)}")

    if anomalies:
        lines.append("\nDetected statistical outliers (IQR method):")
        for a in anomalies[:8]:
            lines.append(f"- {a['semantic_label']} = {a['value']} ({a['direction']} normal range, row {a['row']})")

    if forecast and forecast.get("forecast"):
        lines.append(f"\nForecast for {forecast.get('column', 'primary metric')}: trending {forecast.get('trend')}.")
        next_point = forecast["forecast"][0]
        lines.append(
            f"Next period projected at {next_point['value']} (range {next_point['lower']} to {next_point['upper']})."
        )

    return "\n".join(lines)


class InsightsUnavailable(Exception):
    pass


async def _call_llm_json(system_prompt: str, user_content: str) -> dict:
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


async def generate_insights(
    domain: str,
    row_count: int,
    schema: list[dict],
    anomalies: list[dict] | None = None,
    forecast: dict | None = None,
) -> dict:
    summary = _summarize_for_prompt(domain, row_count, schema, anomalies or [], forecast)
    parsed = await _call_llm_json(_SYSTEM_PROMPT, summary)
    return {
        "insights": parsed.get("insights", []),
        "recommendations": parsed.get("recommendations", []),
    }


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


async def generate_simulation_explanation(domain: str, simulation: dict) -> dict:
    summary = _summarize_simulation_for_prompt(domain, simulation)
    parsed = await _call_llm_json(_SIMULATION_SYSTEM_PROMPT, summary)
    return {
        "summary": parsed.get("summary", ""),
        "assumptions": parsed.get("assumptions", []),
    }
