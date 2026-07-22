"""Additive: ad-hoc SQL querying over an uploaded dataset via DuckDB.

DuckDB queries the cached pandas DataFrame directly (no export/reload
needed) — genuinely useful for exploration beyond the fixed dashboard
panels. Restricted to read-only SELECT statements: this runs arbitrary
user-supplied SQL, and even for a single-user local tool, DuckDB's
SELECT surface includes filesystem-reading table functions (read_csv,
read_parquet, etc.) that an unrestricted query could abuse to read
arbitrary files if this app were ever reachable from another machine.
"""

from __future__ import annotations

import re
from typing import Any

import duckdb
import pandas as pd

_FORBIDDEN_PATTERN = re.compile(
    r"\b(insert|update|delete|drop|alter|create|attach|detach|copy|pragma|install|load|export|import|call)\b",
    re.IGNORECASE,
)

MAX_ROWS = 1000


class UnsafeQueryError(Exception):
    pass


def run_query(df: pd.DataFrame, sql: str, max_rows: int = MAX_ROWS) -> dict[str, Any]:
    stripped = sql.strip().rstrip(";")
    if not stripped:
        raise UnsafeQueryError("Empty query.")
    if ";" in stripped:
        raise UnsafeQueryError("Only a single statement is allowed.")
    if not re.match(r"^\s*(select|with)\b", stripped, re.IGNORECASE):
        raise UnsafeQueryError("Only SELECT queries are allowed.")
    if _FORBIDDEN_PATTERN.search(stripped):
        raise UnsafeQueryError("Query contains a disallowed keyword.")

    con = duckdb.connect(database=":memory:")
    try:
        con.register("df", df)
        result = con.execute(f"SELECT * FROM ({stripped}) AS _q LIMIT {max_rows}").fetchdf()
    except Exception as exc:
        raise UnsafeQueryError(f"Query failed: {exc}") from exc
    finally:
        con.close()

    safe = result.astype(object).where(pd.notna(result), None)
    return {
        "columns": list(result.columns),
        "rows": safe.values.tolist(),
        "row_count": len(result),
        "truncated": len(result) >= max_rows,
    }
