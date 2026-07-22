"""Reconstructs the exact graph from the manual v6 verification against
sample_multi/*.csv, so these tests check the same arithmetic that was
checked by hand: Customer C001 has 3 orders; one of those orders
(O001) links to Product P001, which has 3 orders total referencing it
(only 1 from C001) — so P001's contribution share should be exactly 1/3.
"""

import networkx as nx
import pytest

from digital_twin import simulate_entity_impact


@pytest.fixture
def sample_graph() -> nx.MultiDiGraph:
    g = nx.MultiDiGraph()
    g.add_node("Customers:C001", table="Customers", key="C001")
    for order, product in [("O001", "P001"), ("O003", "P004"), ("O008", "P002")]:
        g.add_node(f"Sales:{order}", table="Sales", key=order)
        g.add_edge(f"Sales:{order}", "Customers:C001", type="CUSTOMER")
    # P001 is also referenced by two orders belonging to other customers
    for order in ["O005", "O007"]:
        g.add_node(f"Sales:{order}", table="Sales", key=order)
        g.add_node("Customers:OTHER", table="Customers", key="OTHER")
        g.add_edge(f"Sales:{order}", "Customers:OTHER", type="CUSTOMER")
        g.add_edge(f"Sales:{order}", "Products:P001", type="PRODUCT")
    g.add_node("Products:P001", table="Products", key="P001")
    g.add_node("Products:P004", table="Products", key="P004")
    g.add_node("Products:P002", table="Products", key="P002")
    g.add_edge("Sales:O001", "Products:P001", type="PRODUCT")
    g.add_edge("Sales:O003", "Products:P004", type="PRODUCT")
    g.add_edge("Sales:O008", "Products:P002", type="PRODUCT")
    return g


def test_unknown_entity_returns_none(sample_graph):
    assert simulate_entity_impact(sample_graph, "Customers:NOPE", 20.0) is None


def test_hop1_orders_get_half_share(sample_graph):
    result = simulate_entity_impact(sample_graph, "Customers:C001", 20.0)
    hop1 = [e for e in result["affected_entities"] if e["hops"] == 1]
    assert len(hop1) == 3
    for e in hop1:
        # each order node has degree 2 (one customer edge, one product edge)
        assert e["contribution_share"] == 0.5
        assert e["estimated_delta_pct"] == 10.0


def test_hop2_product_shared_with_two_other_orders_gets_one_third_share(sample_graph):
    result = simulate_entity_impact(sample_graph, "Customers:C001", 20.0)
    p001 = next(e for e in result["affected_entities"] if e["node"] == "Products:P001")
    assert p001["hops"] == 2
    assert p001["contribution_share"] == pytest.approx(1 / 3, abs=0.001)
    assert p001["estimated_delta_pct"] == pytest.approx(6.67, abs=0.01)


def test_note_always_labels_this_an_estimate_not_a_causal_claim(sample_graph):
    result = simulate_entity_impact(sample_graph, "Customers:C001", 20.0)
    assert "not a proven causal" in result["note"]
