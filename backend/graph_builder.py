"""Builds a lightweight semantic knowledge graph from an inferred schema.

v2 scope: a single uploaded table becomes a star schema — a central
"dataset" node (labeled by the guessed domain), dimension/entity nodes for
id/categorical/date columns, and measure nodes for numeric columns. When
IntelliVerse supports multi-table/multi-file uploads later, this is the seam where
cross-table joins become graph edges instead of everything hanging off one
root node.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from schema_inference import ColumnSchema

NodeType = Literal["root", "entity", "dimension", "time", "measure"]


@dataclass
class GraphNode:
    id: str
    label: str
    node_type: NodeType


@dataclass
class GraphEdge:
    source: str
    target: str
    label: str


@dataclass
class KnowledgeGraph:
    nodes: list[GraphNode] = field(default_factory=list)
    edges: list[GraphEdge] = field(default_factory=list)


def build_knowledge_graph(schema: list[ColumnSchema], domain: str) -> KnowledgeGraph:
    graph = KnowledgeGraph()
    root_id = "dataset"
    graph.nodes.append(GraphNode(id=root_id, label=domain, node_type="root"))

    for col in schema:
        node_id = f"col:{col.name}"

        if col.type == "id":
            graph.nodes.append(GraphNode(id=node_id, label=col.semantic_label, node_type="entity"))
            graph.edges.append(GraphEdge(source=root_id, target=node_id, label="identifies"))
        elif col.type == "categorical" or col.type == "boolean":
            graph.nodes.append(GraphNode(id=node_id, label=col.semantic_label, node_type="dimension"))
            graph.edges.append(GraphEdge(source=root_id, target=node_id, label="grouped by"))
        elif col.type == "date":
            graph.nodes.append(GraphNode(id=node_id, label=col.semantic_label, node_type="time"))
            graph.edges.append(GraphEdge(source=root_id, target=node_id, label="occurs at"))
        elif col.type == "numeric":
            graph.nodes.append(GraphNode(id=node_id, label=col.semantic_label, node_type="measure"))
            graph.edges.append(GraphEdge(source=root_id, target=node_id, label="measures"))
        # free-text columns are not graphed in v2 — nothing structural to connect them to yet

    return graph
