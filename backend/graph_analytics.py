"""V5: graph analytics via NetworkX — PageRank, degree centrality,
connected components. Deterministic graph algorithms only; no LLM
involved. Runs on the in-memory graph built during ingestion.
"""

from __future__ import annotations

from typing import Any

import networkx as nx


def compute_graph_analytics(graph: nx.MultiDiGraph, top_n: int = 5) -> dict[str, Any]:
    if graph.number_of_nodes() == 0:
        return {
            "top_pagerank": [],
            "top_degree_centrality": [],
            "connected_components": 0,
            "component_sizes": [],
        }

    undirected = graph.to_undirected()

    try:
        pagerank = nx.pagerank(graph)
    except Exception:
        pagerank = {}

    degree_centrality = nx.degree_centrality(graph)
    components = list(nx.connected_components(undirected))
    component_sizes = sorted((len(c) for c in components), reverse=True)

    def _top(scores: dict[str, float]) -> list[dict[str, Any]]:
        ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:top_n]
        return [
            {
                "node": node_id,
                "table": graph.nodes[node_id].get("table"),
                "key": graph.nodes[node_id].get("key"),
                "score": round(score, 4),
            }
            for node_id, score in ranked
        ]

    return {
        "top_pagerank": _top(pagerank),
        "top_degree_centrality": _top(degree_centrality),
        "connected_components": len(components),
        "component_sizes": component_sizes[:10],
    }
