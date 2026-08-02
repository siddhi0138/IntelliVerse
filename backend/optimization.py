"""V8: scenario optimization — searches combinations of multiple decision
levers at once for the one that best moves a chosen target metric, instead
of testing one lever at a time like `simulation.py` does.

Same honesty as the single-lever simulator: this fits a multivariate linear
model between the levers and the target across historical rows (an
association, not a causal effect), reports R-squared as confidence in that
model, then searches many candidate lever combinations scored against it —
real search over the feasible region, not just a coefficient read-off.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score

from schema_inference import ColumnSchema
from simulation import ASSOCIATION_NOTE, _coerce_numeric

DEFAULT_LEVER_RANGE = 30.0  # each lever may move -30%..+30% unless a budget caps it further
N_SAMPLES = 4000


class OptimizationUnavailable(Exception):
    pass


@dataclass
class LeverSetting:
    column: str
    semantic_label: str
    pct_change: float


@dataclass
class OptimizationCandidate:
    levers: list[LeverSetting]
    projected_target: float
    delta_pct: float | None


@dataclass
class OptimizationResult:
    target_column: str
    target_label: str
    baseline_target: float
    r_squared: float
    best: OptimizationCandidate
    runners_up: list[OptimizationCandidate] = field(default_factory=list)
    samples_tried: int = N_SAMPLES
    note: str = ASSOCIATION_NOTE


def _labels(schema: list[ColumnSchema], columns: list[str]) -> dict[str, str]:
    by_name = {c.name: c.semantic_label for c in schema}
    return {col: by_name.get(col, col) for col in columns}


def optimize(
    df: pd.DataFrame,
    schema: list[ColumnSchema],
    target_column: str,
    lever_columns: list[str],
    budget_pct: float | None = None,
    lever_range: float = DEFAULT_LEVER_RANGE,
    n_samples: int = N_SAMPLES,
    seed: int = 0,
) -> OptimizationResult:
    target_schema = next((c for c in schema if c.name == target_column), None)
    target_label = target_schema.semantic_label if target_schema else target_column

    lever_columns = [c for c in dict.fromkeys(lever_columns) if c != target_column]
    if not lever_columns:
        raise OptimizationUnavailable("Pick at least one lever column different from the target metric.")

    target_vals = _coerce_numeric(df, target_column)
    lever_vals = {col: _coerce_numeric(df, col) for col in lever_columns}
    combined = pd.DataFrame({"target": target_vals, **lever_vals}).dropna()
    if len(combined) < 5:
        raise OptimizationUnavailable(
            "Not enough overlapping rows across the target and chosen levers to model this."
        )

    X = combined[lever_columns].to_numpy()
    y = combined["target"].to_numpy()
    if any(combined[col].std() == 0 for col in lever_columns):
        raise OptimizationUnavailable("One of the chosen levers doesn't vary in this dataset.")

    model = LinearRegression().fit(X, y)
    r_squared = float(r2_score(y, model.predict(X)))

    n = len(combined)
    intercept_total = float(model.intercept_) * n
    baseline_lever_sums = {col: float(combined[col].sum()) for col in lever_columns}
    baseline_target = float(combined["target"].sum())
    coefs = dict(zip(lever_columns, model.coef_.tolist()))

    def projected_total(pct_changes: dict[str, float]) -> float:
        total = intercept_total
        for col in lever_columns:
            new_sum = baseline_lever_sums[col] * (1 + pct_changes[col] / 100)
            total += coefs[col] * new_sum
        return total

    def fits_budget(pct_changes: dict[str, float]) -> dict[str, float]:
        if budget_pct is None:
            return pct_changes
        used = sum(abs(v) for v in pct_changes.values())
        if used <= budget_pct or used == 0:
            return pct_changes
        scale = budget_pct / used
        return {k: v * scale for k, v in pct_changes.items()}

    rng = random.Random(seed)
    labels = _labels(schema, lever_columns)

    def to_candidate(pct_changes: dict[str, float]) -> OptimizationCandidate:
        proj = projected_total(pct_changes)
        delta = round((proj - baseline_target) / abs(baseline_target) * 100, 2) if baseline_target else None
        levers = [
            LeverSetting(column=col, semantic_label=labels[col], pct_change=round(pct_changes[col], 1))
            for col in lever_columns
        ]
        return OptimizationCandidate(levers=levers, projected_target=round(proj, 2), delta_pct=delta)

    candidates: list[dict[str, float]] = []

    # A deterministic "push every lever toward its known-beneficial direction,
    # as far as the range/budget allows" candidate — since the underlying
    # model is linear, the true optimum sits at one of these corners.
    corner = {col: (lever_range if coefs[col] >= 0 else -lever_range) for col in lever_columns}
    candidates.append(fits_budget(corner))

    # Real search over the feasible region — this is what actually lets the
    # feature say "tried N combinations", not just read off coefficients.
    for _ in range(n_samples):
        draw = {col: rng.uniform(-lever_range, lever_range) for col in lever_columns}
        candidates.append(fits_budget(draw))

    scored = sorted(candidates, key=projected_total, reverse=True)
    best = to_candidate(scored[0])
    runners_up = [to_candidate(c) for c in scored[1:6]]

    return OptimizationResult(
        target_column=target_column,
        target_label=target_label,
        baseline_target=round(baseline_target, 2),
        r_squared=round(r_squared, 3),
        best=best,
        runners_up=runners_up,
        samples_tried=n_samples + 1,
    )
