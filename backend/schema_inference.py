"""Heuristic schema + semantic inference for arbitrary tabular uploads.

v1 scope: given a pandas DataFrame, guess each column's data type, a
human-readable semantic label, and produce a small set of chart specs for
an auto-generated dashboard. No ML models yet — pure heuristics (regex on
column names + value-shape checks). Good enough to make "upload anything,
get a dashboard" feel real; a learned classifier can replace this later
without changing the API shape.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

import pandas as pd

# --- semantic label heuristics -------------------------------------------------

_SEMANTIC_PATTERNS: list[tuple[str, str]] = [
    (r"cust(omer)?[_ ]?id", "Customer ID"),
    (r"patient[_ ]?id", "Patient ID"),
    (r"order[_ ]?id", "Order ID"),
    (r"product[_ ]?id", "Product ID"),
    (r"employee[_ ]?id", "Employee ID"),
    (r"student[_ ]?id", "Student ID"),
    (r"transaction[_ ]?id", "Transaction ID"),
    (r"^id$|_id$|^id_", "Identifier"),
    (r"(purchase|order|sale|created|txn|transaction)[_ ]?(date|time|at)?$", "Transaction Date"),
    (r"(admission|admit)[_ ]?date", "Admission Date"),
    (r"^date$|_date$|date_", "Date"),
    (r"(amt|amount|revenue|price|cost|total|fare|fee)", "Monetary Amount"),
    (r"(margin|profit)", "Profit / Margin"),
    (r"(region|state|country|city|geo|location)", "Geography"),
    (r"(category|type|segment|class)$", "Category"),
    (r"(product|item|sku)$", "Product"),
    (r"(diagnosis|condition)", "Medical Diagnosis"),
    (r"(doctor|physician)", "Care Provider"),
    (r"(department|dept)", "Department"),
    (r"(quantity|qty|units)", "Quantity"),
    (r"(email)", "Email"),
    (r"(name)$", "Name"),
    (r"(status)$", "Status"),
    (r"(rating|score|satisfaction)", "Score / Rating"),
]

# domain scoring: keyword -> industry, used as a simple weighted vote
_DOMAIN_KEYWORDS: dict[str, list[str]] = {
    "Healthcare": ["patient", "diagnosis", "admission", "doctor", "physician", "hospital", "treatment", "ward"],
    "Retail / E-commerce": ["order", "product", "sku", "cart", "customer", "purchase", "discount", "inventory"],
    "Education": ["student", "course", "grade", "gpa", "cgpa", "faculty", "attendance", "enrollment"],
    "Finance / Banking": ["account", "transaction", "balance", "loan", "interest", "credit", "fraud"],
    "Manufacturing": ["machine", "downtime", "yield", "oee", "factory", "production_line", "defect"],
    "Logistics / Supply Chain": ["shipment", "warehouse", "carrier", "route", "delivery", "supplier"],
}


def _guess_semantic_label(col_name: str) -> str | None:
    lowered = col_name.strip().lower()
    for pattern, label in _SEMANTIC_PATTERNS:
        if re.search(pattern, lowered):
            return label
    return None


def guess_domain(columns: list[str]) -> str:
    lowered_cols = " ".join(c.lower() for c in columns)
    scores = {domain: 0 for domain in _DOMAIN_KEYWORDS}
    for domain, keywords in _DOMAIN_KEYWORDS.items():
        for kw in keywords:
            if kw in lowered_cols:
                scores[domain] += 1
    best_domain = max(scores, key=scores.get)
    if scores[best_domain] == 0:
        return "General / Unclassified"
    return best_domain


# --- column type inference -----------------------------------------------------

ColumnType = str  # one of: id, numeric, boolean, date, categorical, text


def _infer_column_type(series: pd.Series, col_name: str) -> ColumnType:
    n = len(series)
    non_null = series.dropna()
    if non_null.empty:
        return "text"

    lowered = col_name.strip().lower()

    # boolean
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    unique_lower = {str(v).strip().lower() for v in non_null.unique()[:10]}
    if unique_lower and unique_lower <= {"true", "false", "yes", "no", "y", "n", "0", "1"} and non_null.nunique() <= 2:
        return "boolean"

    # explicit id-like name with near-unique values
    if re.search(r"(^id$|_id$|^id_|id$)", lowered) and non_null.nunique() / n > 0.9:
        return "id"

    # datetime
    if pd.api.types.is_datetime64_any_dtype(series):
        return "date"
    if series.dtype == object:
        sample = non_null.astype(str).head(20)
        parsed = pd.to_datetime(sample, errors="coerce", format="mixed")
        if parsed.notna().mean() > 0.8:
            return "date"

    # numeric
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    if series.dtype == object:
        coerced = pd.to_numeric(non_null.astype(str).str.replace(r"[,$%]", "", regex=True), errors="coerce")
        if coerced.notna().mean() > 0.9:
            return "numeric"

    # categorical vs free text: low cardinality relative to row count
    nunique_ratio = non_null.nunique() / n
    avg_len = non_null.astype(str).str.len().mean()
    if nunique_ratio < 0.5 and non_null.nunique() <= 50:
        return "categorical"
    if avg_len is not None and avg_len > 40:
        return "text"
    return "categorical" if nunique_ratio < 0.7 else "text"


@dataclass
class ColumnSchema:
    name: str
    type: ColumnType
    semantic_label: str
    stats: dict[str, Any] = field(default_factory=dict)


def _column_stats(series: pd.Series, col_type: ColumnType) -> dict[str, Any]:
    non_null = series.dropna()
    stats: dict[str, Any] = {
        "null_count": int(series.isna().sum()),
        "unique_count": int(non_null.nunique()),
    }

    if col_type == "numeric":
        numeric = pd.to_numeric(
            non_null.astype(str).str.replace(r"[,$%]", "", regex=True) if series.dtype == object else non_null,
            errors="coerce",
        ).dropna()
        if not numeric.empty:
            stats.update(
                {
                    "min": float(numeric.min()),
                    "max": float(numeric.max()),
                    "mean": float(numeric.mean()),
                    "sum": float(numeric.sum()),
                }
            )
    elif col_type == "categorical":
        counts = non_null.astype(str).value_counts().head(10)
        stats["top_values"] = [{"value": str(k), "count": int(v)} for k, v in counts.items()]
    elif col_type == "date":
        parsed = pd.to_datetime(non_null, errors="coerce", format="mixed")
        parsed = parsed.dropna()
        if not parsed.empty:
            stats["min_date"] = parsed.min().date().isoformat()
            stats["max_date"] = parsed.max().date().isoformat()
    elif col_type == "boolean":
        counts = non_null.astype(str).str.lower().value_counts()
        stats["value_counts"] = {str(k): int(v) for k, v in counts.items()}

    return stats


def build_schema(df: pd.DataFrame) -> list[ColumnSchema]:
    schema: list[ColumnSchema] = []
    for col in df.columns:
        col_type = _infer_column_type(df[col], col)
        semantic = _guess_semantic_label(col) or col.replace("_", " ").title()
        stats = _column_stats(df[col], col_type)
        schema.append(ColumnSchema(name=col, type=col_type, semantic_label=semantic, stats=stats))
    return schema


# --- chart suggestion ----------------------------------------------------------

@dataclass
class ChartSpec:
    id: str
    title: str
    chart_type: str  # "kpi" | "bar" | "line" | "pie"
    x: str | None = None
    y: str | None = None
    data: list[dict[str, Any]] = field(default_factory=list)


def _monthly_series(df: pd.DataFrame, date_col: str, numeric_col: str) -> list[dict[str, Any]]:
    dates = pd.to_datetime(df[date_col], errors="coerce", format="mixed")
    values = pd.to_numeric(
        df[numeric_col].astype(str).str.replace(r"[,$%]", "", regex=True)
        if df[numeric_col].dtype == object
        else df[numeric_col],
        errors="coerce",
    )
    frame = pd.DataFrame({"date": dates, "value": values}).dropna()
    if frame.empty:
        return []
    frame["period"] = frame["date"].dt.to_period("M").astype(str)
    grouped = frame.groupby("period")["value"].sum().reset_index()
    grouped = grouped.sort_values("period")
    return [{"period": row.period, "value": round(row.value, 2)} for row in grouped.itertuples()]


def suggest_charts(df: pd.DataFrame, schema: list[ColumnSchema]) -> list[ChartSpec]:
    charts: list[ChartSpec] = []

    numeric_cols = [c for c in schema if c.type == "numeric"]
    categorical_cols = [c for c in schema if c.type == "categorical"]
    date_cols = [c for c in schema if c.type == "date"]

    # KPI row: row count + sum/mean of first few numeric columns
    kpi_data = [{"label": "Rows", "value": len(df)}]
    for col in numeric_cols[:3]:
        if "sum" in col.stats:
            kpi_data.append({"label": f"Total {col.semantic_label}", "value": round(col.stats["sum"], 2)})
    charts.append(ChartSpec(id="kpi-overview", title="Overview", chart_type="kpi", data=kpi_data))

    # bar chart per categorical column (top values)
    for col in categorical_cols[:4]:
        top_values = col.stats.get("top_values", [])
        if top_values:
            charts.append(
                ChartSpec(
                    id=f"bar-{col.name}",
                    title=f"{col.semantic_label} breakdown",
                    chart_type="bar",
                    x=col.name,
                    y="count",
                    data=[{"name": v["value"], "count": v["count"]} for v in top_values],
                )
            )

    # time series: pair first date column with first numeric column
    if date_cols and numeric_cols:
        date_col = date_cols[0]
        numeric_col = numeric_cols[0]
        series = _monthly_series(df, date_col.name, numeric_col.name)
        if series:
            charts.append(
                ChartSpec(
                    id=f"line-{numeric_col.name}",
                    title=f"{numeric_col.semantic_label} over time",
                    chart_type="line",
                    x="period",
                    y="value",
                    data=series,
                )
            )

    return charts
