"""V5: relationship discovery across multiple uploaded tables.

Detects candidate foreign-key relationships purely from what's actually
in the data: column name similarity plus *measured* value overlap
between candidate key columns (what fraction of table A's column values
actually appear in table B's column). Nothing here creates a
relationship the user hasn't confirmed — main.py only ingests
relationships the frontend sends back after review. Every candidate
carries the evidence (overlap %, whether the target side looks like a
primary key) so the confidence score is inspectable, not asserted.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from itertools import permutations

import pandas as pd

from schema_inference import ColumnSchema


def _normalize_name(name: str) -> str:
    return re.sub(r"[_\s]", "", name).lower()


def _strip_id_suffix(name: str) -> str:
    return re.sub(r"(_?id|_?no|_?number)$", "", name, flags=re.IGNORECASE)


@dataclass
class RelationshipCandidate:
    from_table: str
    from_column: str
    to_table: str
    to_column: str
    confidence: float
    overlap_pct: float
    to_column_is_unique: bool
    relationship_type: str  # "many_to_one" | "many_to_many"
    evidence: str


def _key_like_columns(schema: list[ColumnSchema]) -> list[ColumnSchema]:
    return [c for c in schema if c.type in ("id", "numeric", "categorical", "text")]


def discover_relationships(
    tables: dict[str, pd.DataFrame],
    schemas: dict[str, list[ColumnSchema]],
    min_confidence: float = 0.5,
) -> list[RelationshipCandidate]:
    candidates: list[RelationshipCandidate] = []
    table_names = list(tables.keys())

    for table_a, table_b in permutations(table_names, 2):
        df_a, df_b = tables[table_a], tables[table_b]
        cols_a = _key_like_columns(schemas[table_a])
        cols_b = _key_like_columns(schemas[table_b])

        for col_a in cols_a:
            for col_b in cols_b:
                name_a_norm = _normalize_name(_strip_id_suffix(col_a.name))
                name_b_norm = _normalize_name(_strip_id_suffix(col_b.name))
                table_b_norm = _normalize_name(_strip_id_suffix(table_b)).rstrip("s")

                name_match = name_a_norm == name_b_norm
                references_table = name_a_norm.rstrip("s") == table_b_norm

                if not (name_match or references_table):
                    continue

                values_a = set(df_a[col_a.name].dropna().unique())
                values_b = set(df_b[col_b.name].dropna().unique())
                if not values_a or not values_b:
                    continue

                overlap = len(values_a & values_b) / len(values_a)
                if overlap < 0.5:
                    continue

                non_null_b = df_b[col_b.name].dropna()
                b_is_unique = len(non_null_b) > 0 and non_null_b.nunique() == len(non_null_b)

                confidence = (0.3 if name_match else 0.15) + 0.4 * overlap + (0.3 if b_is_unique else 0.0)
                confidence = round(min(confidence, 1.0), 2)
                if confidence < min_confidence:
                    continue

                evidence = f"{overlap * 100:.0f}% of {table_a}.{col_a.name} values found in {table_b}.{col_b.name}"
                if b_is_unique:
                    evidence += f" ({table_b}.{col_b.name} is unique — looks like a primary key)"

                candidates.append(
                    RelationshipCandidate(
                        from_table=table_a,
                        from_column=col_a.name,
                        to_table=table_b,
                        to_column=col_b.name,
                        confidence=confidence,
                        overlap_pct=round(overlap * 100, 1),
                        to_column_is_unique=b_is_unique,
                        relationship_type="many_to_one" if b_is_unique else "many_to_many",
                        evidence=evidence,
                    )
                )

    # a pair of columns can match in both directions (A->B and B->A checked
    # separately by permutations) — keep only the higher-confidence direction
    best_by_pair: dict[tuple[str, str], RelationshipCandidate] = {}
    for c in candidates:
        key = tuple(sorted([f"{c.from_table}.{c.from_column}", f"{c.to_table}.{c.to_column}"]))
        if key not in best_by_pair or c.confidence > best_by_pair[key].confidence:
            best_by_pair[key] = c

    result = list(best_by_pair.values())
    result.sort(key=lambda c: c.confidence, reverse=True)
    return result
