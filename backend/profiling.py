"""V1 backfill: dataset profiling beyond per-column schema stats.

Deterministic, rule-based checks only — duplicate rows, implausible values
for columns with a recognizable semantic meaning (e.g. a negative
Quantity), and a composite data quality score. No LLM involved: these are
exactly the kind of checks that should be computed, not guessed, and the
user decides whether to act on the recommendations — nothing here mutates
the uploaded data.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from schema_inference import ColumnSchema

# semantic labels where a negative value is implausible
_NON_NEGATIVE_LABELS = {"Quantity", "Monetary Amount", "Age", "Score / Rating"}


@dataclass
class InvalidValueIssue:
    column: str
    semantic_label: str
    issue: str
    count: int
    examples: list[str] = field(default_factory=list)


@dataclass
class QualityRecommendation:
    column: str | None
    severity: str  # "high" | "medium" | "low"
    issue: str
    recommendation: str


@dataclass
class DataQualityReport:
    score: float  # 0-100
    duplicate_row_count: int
    duplicate_row_pct: float
    invalid_values: list[InvalidValueIssue] = field(default_factory=list)
    recommendations: list[QualityRecommendation] = field(default_factory=list)


def detect_duplicates(df: pd.DataFrame) -> tuple[int, float]:
    dup_count = int(df.duplicated().sum())
    pct = round(dup_count / len(df) * 100, 2) if len(df) else 0.0
    return dup_count, pct


def _coerce_numeric(df: pd.DataFrame, col: str) -> pd.Series:
    series = df[col]
    if series.dtype == object:
        return pd.to_numeric(series.astype(str).str.replace(r"[,$%]", "", regex=True), errors="coerce")
    return pd.to_numeric(series, errors="coerce")


def detect_invalid_values(df: pd.DataFrame, schema: list[ColumnSchema]) -> list[InvalidValueIssue]:
    issues: list[InvalidValueIssue] = []

    for col in schema:
        if col.type == "numeric" and col.semantic_label in _NON_NEGATIVE_LABELS:
            values = _coerce_numeric(df, col.name)
            negative_mask = values < 0
            count = int(negative_mask.sum())
            if count > 0:
                issues.append(
                    InvalidValueIssue(
                        column=col.name,
                        semantic_label=col.semantic_label,
                        issue=f"Negative values found for {col.semantic_label}, which is not expected to be negative.",
                        count=count,
                        examples=[str(v) for v in values[negative_mask].head(3).tolist()],
                    )
                )

        if col.type == "id":
            non_null = df[col.name].dropna()
            dup_ids = non_null[non_null.duplicated()]
            if len(dup_ids) > 0:
                issues.append(
                    InvalidValueIssue(
                        column=col.name,
                        semantic_label=col.semantic_label,
                        issue=f"{col.semantic_label} column has duplicate identifiers, which should be unique.",
                        count=int(len(dup_ids)),
                        examples=[str(v) for v in dup_ids.head(3).tolist()],
                    )
                )

        if col.type == "categorical":
            non_null = df[col.name].dropna().astype(str)
            normalized = non_null.str.strip().str.lower()
            variants_by_norm = non_null.groupby(normalized).nunique()
            inconsistent_norms = variants_by_norm[variants_by_norm > 1].index
            if len(inconsistent_norms) > 0:
                # count must be the number of affected ROWS, not the number of
                # distinct spelling variants — summing variant counts (e.g. 3
                # for {"USA", "usa", "Usa"}) badly undercounts when a variant
                # is repeated many times (10 rows in that example), which
                # understates invalid_pct and overstates the quality score.
                affected_count = int(normalized.isin(inconsistent_norms).sum())
                issues.append(
                    InvalidValueIssue(
                        column=col.name,
                        semantic_label=col.semantic_label,
                        issue="Inconsistent capitalization/whitespace across otherwise-identical category values.",
                        count=affected_count,
                        examples=list(inconsistent_norms[:3]),
                    )
                )

    return issues


def build_recommendations(
    schema: list[ColumnSchema],
    row_count: int,
    duplicate_row_count: int,
    invalid_values: list[InvalidValueIssue],
) -> list[QualityRecommendation]:
    recs: list[QualityRecommendation] = []

    if duplicate_row_count > 0:
        recs.append(
            QualityRecommendation(
                column=None,
                severity="medium" if duplicate_row_count > 1 else "low",
                issue=f"{duplicate_row_count} fully duplicate row(s) detected.",
                recommendation="Review and consider dropping duplicate rows before analysis.",
            )
        )

    if row_count > 0:
        for col in schema:
            null_count = col.stats.get("null_count", 0)
            if null_count == 0:
                continue
            missing_pct = round(null_count / row_count * 100, 1)
            if missing_pct < 1:
                continue

            severity = "high" if missing_pct >= 20 else "medium" if missing_pct >= 5 else "low"
            if col.type == "numeric":
                recommendation = "Median imputation, or drop rows if missingness is small."
            elif col.type in ("categorical", "boolean"):
                recommendation = "Mode imputation, or add an explicit 'Unknown' category."
            elif col.type == "date":
                recommendation = "Investigate the source of missing dates — imputation is usually inappropriate for dates."
            else:
                recommendation = "Review missing values manually."

            recs.append(
                QualityRecommendation(
                    column=col.name,
                    severity=severity,
                    issue=f"{col.semantic_label} is missing in {missing_pct}% of rows.",
                    recommendation=recommendation,
                )
            )

    for issue in invalid_values:
        recs.append(
            QualityRecommendation(
                column=issue.column,
                severity="medium",
                issue=issue.issue,
                recommendation="Review these values manually before relying on this column in analysis.",
            )
        )

    order = {"high": 0, "medium": 1, "low": 2}
    recs.sort(key=lambda r: order.get(r.severity, 3))
    return recs


def compute_quality_score(
    schema: list[ColumnSchema],
    row_count: int,
    duplicate_row_pct: float,
    invalid_values: list[InvalidValueIssue],
) -> float:
    """Deterministic 0-100 composite. Not a statistical measure — a simple,
    documented weighting so users get one glanceable number: start at 100
    and subtract capped penalties for missingness, duplicates, and invalid
    values."""
    if row_count == 0:
        return 0.0

    if schema:
        avg_missing_pct = sum(c.stats.get("null_count", 0) for c in schema) / (len(schema) * row_count) * 100
    else:
        avg_missing_pct = 0.0

    invalid_count = sum(i.count for i in invalid_values)
    invalid_pct = (invalid_count / row_count) * 100 if row_count else 0.0

    score = 100.0
    score -= min(avg_missing_pct * 1.0, 40)
    score -= min(duplicate_row_pct * 2.0, 30)
    score -= min(invalid_pct * 1.5, 30)
    return round(max(score, 0.0), 1)


def build_quality_report(df: pd.DataFrame, schema: list[ColumnSchema]) -> DataQualityReport:
    duplicate_row_count, duplicate_row_pct = detect_duplicates(df)
    invalid_values = detect_invalid_values(df, schema)
    recommendations = build_recommendations(schema, len(df), duplicate_row_count, invalid_values)
    score = compute_quality_score(schema, len(df), duplicate_row_pct, invalid_values)
    return DataQualityReport(
        score=score,
        duplicate_row_count=duplicate_row_count,
        duplicate_row_pct=duplicate_row_pct,
        invalid_values=invalid_values,
        recommendations=recommendations,
    )
