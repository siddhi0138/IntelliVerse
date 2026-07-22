"""V5: Neo4j connection management.

A single shared driver for the process, matching the pattern of the other
env-configured clients in this backend (FreeLLMAPI's LLM_BASE_URL, etc.).
Nothing here decides *what* to write to the graph — that's
knowledge_graph_builder.py. This module only owns the connection.
"""

from __future__ import annotations

import os

from neo4j import Driver, GraphDatabase

NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.environ.get("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "")

_driver: Driver | None = None


def get_driver() -> Driver:
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    return _driver


def close_driver() -> None:
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None
