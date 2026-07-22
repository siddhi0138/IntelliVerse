"""V5: knowledge graph builder.

Ingests each uploaded table's rows as entity nodes (one Neo4j node per
row, labeled by table name) and only the *confirmed* relationships as
edges, using batched UNWIND writes. A parallel NetworkX graph is built
from the same ingested data for graph algorithms (PageRank, centrality,
connected components) — Neo4j is the persistent store, NetworkX is the
in-process compute engine for this request.

Scope limit, stated plainly: rows are capped per table
(MAX_ROWS_PER_TABLE) to keep ingestion and analytics fast within a live
request/response cycle. This is a live analytical tool, not a batch ETL
pipeline — a real multi-million-row warehouse load would need a
background job, which is out of scope here.
"""

from __future__ import annotations

import re
from typing import Any

import networkx as nx
import numpy as np
import pandas as pd

from multi_table import RelationshipCandidate
from neo4j_client import get_driver
from schema_inference import ColumnSchema

MAX_ROWS_PER_TABLE = 2000


def _row_id_column(schema: list[ColumnSchema]) -> str | None:
    id_cols = [c for c in schema if c.type == "id"]
    return id_cols[0].name if id_cols else None


def _relationship_type_name(column_name: str) -> str:
    stripped = column_name
    for suffix in ("_id", "Id", "ID", "_no", "_number"):
        if stripped.endswith(suffix):
            stripped = stripped[: -len(suffix)]
            break
    return re.sub(r"[^A-Za-z0-9]", "_", stripped).upper() or "REFERENCES"


def _sanitize_value(v: Any) -> Any:
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None
    if isinstance(v, np.integer):
        return int(v)
    if isinstance(v, np.floating):
        return float(v)
    if isinstance(v, np.bool_):
        return bool(v)
    if isinstance(v, pd.Timestamp):
        return v.isoformat()
    if isinstance(v, (str, int, float, bool)):
        return v
    return str(v)


def build_graph(
    workspace_id: str,
    tables: dict[str, pd.DataFrame],
    schemas: dict[str, list[ColumnSchema]],
    relationships: list[RelationshipCandidate],
) -> dict[str, Any]:
    driver = get_driver()
    graph = nx.MultiDiGraph()
    row_id_columns: dict[str, str] = {}

    with driver.session() as session:
        # idempotent: clear any previous ingestion for this workspace first
        session.run("MATCH (n {_workspace_id: $wid}) DETACH DELETE n", wid=workspace_id)

        for table_name, df in tables.items():
            schema = schemas[table_name]
            key_col = _row_id_column(schema) or df.columns[0]
            row_id_columns[table_name] = key_col

            sample = df.head(MAX_ROWS_PER_TABLE)
            records = []
            for _, row in sample.iterrows():
                props = {k: _sanitize_value(v) for k, v in row.to_dict().items()}
                props["_workspace_id"] = workspace_id
                props["_key"] = str(row[key_col])
                records.append(props)
                graph.add_node(f"{table_name}:{row[key_col]}", table=table_name, key=str(row[key_col]))

            session.run(
                f"UNWIND $rows AS row MERGE (n:`{table_name}` {{_workspace_id: row._workspace_id, _key: row._key}}) SET n += row",
                rows=records,
            )

        for rel in relationships:
            from_key_col = row_id_columns.get(rel.from_table, tables[rel.from_table].columns[0])
            rel_type = _relationship_type_name(rel.from_column)

            from_sample = tables[rel.from_table].head(MAX_ROWS_PER_TABLE)
            pairs = [
                {"from_key": str(row[from_key_col]), "to_key": str(row[rel.from_column])}
                for _, row in from_sample.iterrows()
                if pd.notna(row.get(rel.from_column))
            ]
            if not pairs:
                continue

            session.run(
                f"""
                UNWIND $pairs AS pair
                MATCH (a:`{rel.from_table}` {{_workspace_id: $wid, _key: pair.from_key}})
                MATCH (b:`{rel.to_table}` {{_workspace_id: $wid, _key: pair.to_key}})
                MERGE (a)-[r:`{rel_type}`]->(b)
                """,
                pairs=pairs,
                wid=workspace_id,
            )

            for p in pairs:
                a_node, b_node = f"{rel.from_table}:{p['from_key']}", f"{rel.to_table}:{p['to_key']}"
                if graph.has_node(a_node) and graph.has_node(b_node):
                    graph.add_edge(a_node, b_node, type=rel_type)

    return {"node_count": graph.number_of_nodes(), "edge_count": graph.number_of_edges(), "graph": graph}
