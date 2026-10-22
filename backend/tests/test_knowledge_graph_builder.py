from unittest.mock import MagicMock, patch

from knowledge_graph_builder import build_graph
from multi_table import discover_relationships
from schema_inference import build_schema


def test_graph_is_correct_even_when_neo4j_is_completely_unreachable(multi_table_dfs):
    """The whole point of the Neo4j mirror being best-effort: a paused/
    deleted free-tier Aura instance must not prevent the knowledge graph
    endpoint from working, since every endpoint actually serves the
    NetworkX graph build_graph() returns, not a live Neo4j read."""
    schemas = {name: build_schema(df) for name, df in multi_table_dfs.items()}
    relationships = discover_relationships(multi_table_dfs, schemas)

    with patch("knowledge_graph_builder.get_driver", side_effect=ConnectionError("Aura instance paused")):
        result = build_graph("ws1", multi_table_dfs, schemas, relationships)

    assert result["node_count"] == sum(len(df) for df in multi_table_dfs.values())
    assert result["edge_count"] > 0
    graph = result["graph"]
    assert graph.has_edge("Sales:O001", "Customers:C001")
    assert graph.has_edge("Sales:O001", "Products:P001")


def test_graph_mirrors_to_neo4j_when_it_is_reachable(multi_table_dfs):
    schemas = {name: build_schema(df) for name, df in multi_table_dfs.items()}
    relationships = discover_relationships(multi_table_dfs, schemas)

    fake_session = MagicMock()
    fake_driver = MagicMock()
    fake_driver.session.return_value.__enter__.return_value = fake_session

    with patch("knowledge_graph_builder.get_driver", return_value=fake_driver):
        result = build_graph("ws1", multi_table_dfs, schemas, relationships)

    assert result["node_count"] == sum(len(df) for df in multi_table_dfs.values())
    # one DETACH DELETE + one UNWIND-MERGE per table + one UNWIND-MERGE per relationship
    assert fake_session.run.call_count == 1 + len(multi_table_dfs) + len(relationships)


def test_neo4j_failure_midway_through_mirroring_does_not_lose_the_graph(multi_table_dfs):
    """A connection that succeeds initially but fails partway through (the
    exact 500 this was built to prevent) must still leave build_graph's
    own return value fully correct — the NetworkX build happens entirely
    before the Neo4j mirror is even attempted."""
    schemas = {name: build_schema(df) for name, df in multi_table_dfs.items()}
    relationships = discover_relationships(multi_table_dfs, schemas)

    fake_session = MagicMock()
    fake_session.run.side_effect = ConnectionError("connection reset mid-write")
    fake_driver = MagicMock()
    fake_driver.session.return_value.__enter__.return_value = fake_session

    with patch("knowledge_graph_builder.get_driver", return_value=fake_driver):
        result = build_graph("ws1", multi_table_dfs, schemas, relationships)

    assert result["node_count"] == sum(len(df) for df in multi_table_dfs.values())
    assert result["edge_count"] > 0
