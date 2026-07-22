"""V7 (lean): autonomous action-plan synthesis.

"Autonomous AI Analyst" per the original spec means an agent that
decides what to investigate and recommends what to do next, rather than
only answering a posed question. Built here as a deterministic pipeline
over everything already computed elsewhere in this backend — ranked
findings (v2), risk alerts (v3), root cause (v2), forecast (v3), and a
real decision-simulation preview (v4, actually run against the cached
DataFrame, not just described) — rather than a general-purpose
multi-agent framework (LangGraph) or a vector-search RAG system
(Qdrant/LlamaIndex).

That's a deliberate scope decision, not an oversight: RAG needs
something to search — an unstructured document corpus — and this app
has none. The "knowledge base" an analyst draws on here is the
dataset's own computed statistics, which are already fully structured;
adding a vector database to search over data that's already a
structured JSON blob would be technology for its own sake. The LLM step
below only prioritizes and narrates already-computed findings into a
plan, same "compute first, narrate second" rule as every other LLM call
in this backend — it does not decide what analyses exist, only which of
the ones already run are worth acting on.
"""

from __future__ import annotations

from typing import Any

from insights import call_llm_json

_SYSTEM_PROMPT = """You are an autonomous data analyst producing a prioritized action plan. \
You are given every signal already computed about this dataset: ranked statistical findings \
(correlations, associations, root-cause variance breakdowns, anomalies), risk alerts derived \
from a forecast, the forecast itself with its validation metrics, and a preview of one \
decision simulation already run against the primary metric.

Decide which of these signals are actually worth acting on, and produce a short, prioritized \
action plan. Every action MUST cite which specific signal(s) it is grounded in — do not invent \
a reason that isn't traceable to something in the input. If the signals are weak or sparse, \
say so honestly and keep the plan short rather than padding it.

Respond with strict JSON only, no markdown fences, matching exactly this shape:
{"summary": "2-3 sentence overview of the situation",
 "actions": [{"priority": 1, "action": "short imperative action", "rationale": "why, citing the specific signal",
              "grounded_in": "which input signal this comes from (e.g. 'root cause: Region')", "confidence": "high|medium|low"}]}

Return at most 5 actions, ordered by priority (1 = most important)."""


def _summarize_for_prompt(
    domain: str,
    ranked_findings: list[dict],
    risk_alerts: list[dict],
    root_cause: dict | None,
    forecast: dict | None,
    quality: dict | None,
    simulation_preview: dict | None,
) -> str:
    lines = [f"Domain guess: {domain}"]

    if quality:
        lines.append(f"Data quality score: {quality.get('score')}/100")

    if ranked_findings:
        lines.append("\nTop ranked statistical findings (already computed, sorted by strength):")
        for f in ranked_findings[:6]:
            lines.append(f"- [{f.get('kind')}] {f.get('headline')} (score={f.get('score')})")

    if risk_alerts:
        lines.append("\nRisk alerts (derived from forecast, not free-form):")
        for a in risk_alerts:
            lines.append(f"- {a}")

    if root_cause and root_cause.get("dimensions"):
        lines.append(f"\nRoot cause breakdown for {root_cause.get('metric_label')}:")
        for d in root_cause["dimensions"][:3]:
            lines.append(
                f"- {d['dimension_label']} explains {d['variance_explained_pct']}% of variance "
                f"({d.get('test_used')}, p={d.get('p_value')})"
            )

    if forecast and forecast.get("forecast"):
        lines.append(
            f"\nForecast for {forecast.get('column', 'primary metric')}: trending {forecast.get('trend')} "
            f"(model: {forecast.get('method')})."
        )
        if forecast.get("validation"):
            lines.append(f"Validation metrics: {forecast['validation'].get('metrics')}")

    if simulation_preview:
        driver_label = simulation_preview.get("driver_label")
        pct = simulation_preview.get("pct_change")
        lines.append(f"\nDecision simulation preview: what if {driver_label} changed by {pct}%?")
        for e in simulation_preview.get("effects", [])[:5]:
            if e.get("relationship") == "direct change":
                continue
            lines.append(
                f"- {e.get('semantic_label')}: estimated {e.get('delta_pct')}% change "
                f"(confidence={e.get('confidence')}, r²={e.get('r_squared')})"
            )

    return "\n".join(lines)


async def generate_action_plan(
    domain: str,
    ranked_findings: list[dict],
    risk_alerts: list[dict],
    root_cause: dict | None,
    forecast: dict | None,
    quality: dict | None,
    simulation_preview: dict | None,
) -> dict[str, Any]:
    summary_input = _summarize_for_prompt(
        domain, ranked_findings, risk_alerts, root_cause, forecast, quality, simulation_preview
    )
    parsed = await call_llm_json(_SYSTEM_PROMPT, summary_input)
    return {
        "summary": parsed.get("summary", ""),
        "actions": parsed.get("actions", []),
        "simulation_preview": simulation_preview,
    }
