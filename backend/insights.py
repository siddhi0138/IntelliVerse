"""AI-generated insights over an already-analyzed dataset.

Calls out to an OpenAI-compatible endpoint (FreeLLMAPI by default, running
locally) with a compact statistical summary of the dataset — never raw
rows — and asks for a short list of structured insights. If no provider is
configured or the call fails, callers get an empty list plus a reason
rather than a 500, since insights are a nice-to-have layered on top of the
charts that already render without them.
"""

from __future__ import annotations

import json
import os

import httpx

LLM_BASE_URL = os.environ.get("FREELLMAPI_BASE_URL", "http://localhost:3001/v1")
LLM_API_KEY = os.environ.get("FREELLMAPI_API_KEY", "")
LLM_MODEL = os.environ.get("FREELLMAPI_MODEL", "auto")

_SYSTEM_PROMPT = """You are a senior data analyst. You are given a compact statistical \
summary of a dataset (column types, inferred meanings, and aggregate stats) — not the \
raw rows. Identify the most useful, concrete insights a business user would want to know.

Respond with strict JSON only, no markdown fences, matching exactly this shape:
{"insights": [{"title": "short headline", "description": "1-2 sentences", "confidence": "high|medium|low"}]}

Return at most 5 insights. If the data is too sparse to say anything meaningful, return an empty list."""


def _summarize_for_prompt(domain: str, row_count: int, schema: list[dict]) -> str:
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
    return "\n".join(lines)


class InsightsUnavailable(Exception):
    pass


async def generate_insights(domain: str, row_count: int, schema: list[dict]) -> list[dict]:
    if not LLM_API_KEY:
        raise InsightsUnavailable("No FREELLMAPI_API_KEY configured on the backend.")

    summary = _summarize_for_prompt(domain, row_count, schema)

    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": summary},
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
        parsed = json.loads(content)
        insights = parsed.get("insights", [])
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise InsightsUnavailable(f"Router returned an unparseable response: {exc}") from exc

    return insights
