"""V2: ranked, evidence-backed findings.

Rather than trusting an LLM to rank its own prose, this assembles a
unified list from the deterministic statistical findings already computed
elsewhere (correlations, associations, root-cause dimensions, anomalies)
and scores them by a simple, documented composite of magnitude and
statistical significance — so ranking is grounded in the same numbers a
user can click through to inspect (the "evidence" field), not vibes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from relationships import CategoricalAssociation, NumericCorrelation, RootCauseAnalysis, RootCauseDimension


@dataclass
class RankedFinding:
    kind: str  # "correlation" | "association" | "root_cause" | "anomaly"
    headline: str
    score: float
    evidence: dict[str, Any] = field(default_factory=dict)


def _correlation_score(c: NumericCorrelation) -> float:
    return abs(c.r) + (0.2 if c.significant else 0.0)


def _association_score(a: CategoricalAssociation) -> float:
    return a.cramers_v


def _root_cause_score(dim: RootCauseDimension, max_variance: float) -> float:
    base = dim.variance_explained_pct / max(max_variance, 1e-9)
    return base + (0.2 if dim.significant else 0.0)


def build_ranked_findings(
    correlations: list[NumericCorrelation],
    associations: list[CategoricalAssociation],
    root_cause: RootCauseAnalysis | None,
    anomalies: list[dict[str, Any]],
    max_findings: int = 10,
) -> list[dict[str, Any]]:
    findings: list[RankedFinding] = []

    for c in correlations:
        findings.append(
            RankedFinding(
                kind="correlation",
                headline=f"{c.label_a} and {c.label_b} are {c.strength}ly {c.direction}ly associated (r={c.r})",
                score=_correlation_score(c),
                evidence={"method": c.method, "r": c.r, "p_value": c.p_value, "significant": c.significant},
            )
        )

    for a in associations:
        findings.append(
            RankedFinding(
                kind="association",
                headline=f"{a.label_a} and {a.label_b} show a {a.strength} association (Cramer's V={a.cramers_v})",
                score=_association_score(a),
                evidence={"cramers_v": a.cramers_v},
            )
        )

    if root_cause and root_cause.dimensions:
        max_variance = max(d.variance_explained_pct for d in root_cause.dimensions)
        for dim in root_cause.dimensions:
            findings.append(
                RankedFinding(
                    kind="root_cause",
                    headline=(
                        f"{dim.dimension_label} explains {dim.variance_explained_pct}% of the variance in "
                        f"{root_cause.metric_label} ({dim.test_used}, p={dim.p_value})"
                    ),
                    score=_root_cause_score(dim, max_variance),
                    evidence={
                        "variance_explained_pct": dim.variance_explained_pct,
                        "test_used": dim.test_used,
                        "p_value": dim.p_value,
                        "significant": dim.significant,
                        "top_segment": dim.top_segment,
                    },
                )
            )

    for i, a in enumerate(anomalies):
        findings.append(
            RankedFinding(
                kind="anomaly",
                headline=f"{a['semantic_label']} = {a['value']} is {a['direction']} the normal range ({a.get('method', 'iqr')})",
                score=max(1.0 - i * 0.05, 0.1),  # preserve the deviation-based order anomalies already arrive in
                evidence=a,
            )
        )

    findings.sort(key=lambda f: f.score, reverse=True)
    return [
        {"kind": f.kind, "headline": f.headline, "score": round(f.score, 3), "evidence": f.evidence}
        for f in findings[:max_findings]
    ]
