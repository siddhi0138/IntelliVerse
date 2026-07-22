"""V6: graph-based impact propagation ("digital twin" simulation).

Extends V4's decision-simulation idea from flat column correlations to
the actual entity graph built in V5: a change to one entity doesn't just
correlate with columns in the same table, it cascades through the real,
already-confirmed relationships to the specific connected entities.

This models *structural contribution share*, not statistical correlation:
if a customer's activity changes by X%, and that customer accounts for,
say, 1 of 3 orders referencing a given product, the product's estimated
change is X% scaled by that 1-in-3 share — a bottom-up graph computation,
not a regression fit. It's honest in the same way v4's simulator is
honest: the result is explicitly labeled an estimate derived from graph
structure, not a proven causal or statistical effect, and it can only
ever propagate along edges that were confirmed during v5's relationship
review — nothing is invented here.
"""

from __future__ import annotations

from typing import Any

import networkx as nx

MAX_HOPS = 2
DEFAULT_TOP_N = 10


def simulate_entity_impact(
    graph: nx.MultiDiGraph,
    source_node: str,
    pct_change: float,
    top_n: int = DEFAULT_TOP_N,
) -> dict[str, Any] | None:
    if source_node not in graph:
        return None

    undirected = graph.to_undirected()
    hop1 = set(undirected.neighbors(source_node))

    effects: list[dict[str, Any]] = []

    for node in hop1:
        degree = undirected.degree(node)
        share = (1.0 / degree) if degree > 0 else 0.0
        effects.append(
            {
                "node": node,
                "table": graph.nodes[node].get("table"),
                "key": graph.nodes[node].get("key"),
                "hops": 1,
                "contribution_share": round(share, 3),
                "estimated_delta_pct": round(pct_change * share, 2),
            }
        )

    hop2 = set()
    for n in hop1:
        hop2.update(undirected.neighbors(n))
    hop2 -= hop1
    hop2.discard(source_node)

    for node in hop2:
        connecting_paths = sum(1 for h1 in hop1 if undirected.has_edge(h1, node))
        degree = undirected.degree(node)
        share = (connecting_paths / degree) if degree > 0 else 0.0
        if share <= 0:
            continue
        effects.append(
            {
                "node": node,
                "table": graph.nodes[node].get("table"),
                "key": graph.nodes[node].get("key"),
                "hops": 2,
                "contribution_share": round(share, 3),
                "estimated_delta_pct": round(pct_change * share, 2),
            }
        )

    effects.sort(key=lambda e: abs(e["estimated_delta_pct"]), reverse=True)

    return {
        "source": source_node,
        "pct_change": pct_change,
        "affected_entities": effects[:top_n],
        "note": (
            "Estimated via graph connection share (this entity's fraction of each neighbor's "
            "total connections) — a structural propagation through confirmed relationships, "
            "not a proven causal or statistical effect."
        ),
    }
