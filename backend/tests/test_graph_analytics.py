import networkx as nx

from graph_analytics import compute_graph_analytics


def _star_graph() -> nx.MultiDiGraph:
    """A hub node connected to 4 leaves - the hub should dominate both
    PageRank and degree centrality, an easy real property to assert on."""
    g = nx.MultiDiGraph()
    g.add_node("dataset", table="Sales", key=None)
    for i in range(4):
        leaf = f"col:{i}"
        g.add_node(leaf, table="Sales", key=f"col{i}")
        g.add_edge("dataset", leaf)
    return g


def test_empty_graph_returns_zeroed_result():
    result = compute_graph_analytics(nx.MultiDiGraph())
    assert result == {
        "top_pagerank": [],
        "top_degree_centrality": [],
        "connected_components": 0,
        "component_sizes": [],
    }


def test_hub_node_dominates_degree_centrality():
    # Degree centrality counts total (in+out) edges, so the hub - connected
    # to all 4 leaves - scores highest regardless of edge direction.
    result = compute_graph_analytics(_star_graph())
    assert result["top_degree_centrality"][0]["node"] == "dataset"
    scores = [n["score"] for n in result["top_degree_centrality"]]
    assert scores == sorted(scores, reverse=True)


def test_leaf_nodes_dominate_pagerank_in_an_all_outward_star():
    # PageRank measures importance via *incoming* links - in this graph
    # every edge points hub->leaf, so the hub (zero in-edges) scores lowest
    # and every leaf (exactly one in-edge) scores higher than it.
    result = compute_graph_analytics(_star_graph())
    top_node = result["top_pagerank"][0]["node"]
    assert top_node != "dataset"
    scores = [n["score"] for n in result["top_pagerank"]]
    assert scores == sorted(scores, reverse=True)


def test_node_metadata_is_carried_through():
    result = compute_graph_analytics(_star_graph())
    top = result["top_pagerank"][0]
    assert top["table"] == "Sales"


def test_single_connected_component_for_a_star_graph():
    result = compute_graph_analytics(_star_graph())
    assert result["connected_components"] == 1
    assert result["component_sizes"] == [5]


def test_disconnected_nodes_produce_multiple_components():
    g = _star_graph()
    g.add_node("isolated")
    result = compute_graph_analytics(g)
    assert result["connected_components"] == 2
    assert result["component_sizes"] == [5, 1]


def test_top_n_limits_results():
    result = compute_graph_analytics(_star_graph(), top_n=2)
    assert len(result["top_pagerank"]) == 2
    assert len(result["top_degree_centrality"]) == 2
