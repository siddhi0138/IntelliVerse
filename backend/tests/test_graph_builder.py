from graph_builder import build_knowledge_graph
from schema_inference import ColumnSchema


def test_root_node_labeled_by_domain():
    graph = build_knowledge_graph([], domain="Retail Sales")
    assert len(graph.nodes) == 1
    assert graph.nodes[0].id == "dataset"
    assert graph.nodes[0].label == "Retail Sales"
    assert graph.nodes[0].node_type == "root"


def test_each_column_type_maps_to_the_right_node_type_and_edge_label():
    schema = [
        ColumnSchema(name="Order_ID", type="id", semantic_label="Order identifier"),
        ColumnSchema(name="Region", type="categorical", semantic_label="Region"),
        ColumnSchema(name="Order_Date", type="date", semantic_label="Order date"),
        ColumnSchema(name="Revenue", type="numeric", semantic_label="Revenue"),
        ColumnSchema(name="Notes", type="text", semantic_label="Notes"),
    ]
    graph = build_knowledge_graph(schema, domain="Sales")

    by_id = {n.id: n for n in graph.nodes}
    assert by_id["col:Order_ID"].node_type == "entity"
    assert by_id["col:Region"].node_type == "dimension"
    assert by_id["col:Order_Date"].node_type == "time"
    assert by_id["col:Revenue"].node_type == "measure"
    # free-text columns aren't graphed in v2
    assert "col:Notes" not in by_id

    edges_by_target = {e.target: e for e in graph.edges}
    assert edges_by_target["col:Order_ID"].label == "identifies"
    assert edges_by_target["col:Region"].label == "grouped by"
    assert edges_by_target["col:Order_Date"].label == "occurs at"
    assert edges_by_target["col:Revenue"].label == "measures"
    assert all(e.source == "dataset" for e in graph.edges)


def test_boolean_columns_are_treated_as_dimensions():
    schema = [ColumnSchema(name="Is_Active", type="boolean", semantic_label="Active flag")]
    graph = build_knowledge_graph(schema, domain="Sales")
    measure_node = next(n for n in graph.nodes if n.id == "col:Is_Active")
    assert measure_node.node_type == "dimension"


def test_empty_schema_produces_only_the_root_node():
    graph = build_knowledge_graph([], domain="Empty")
    assert len(graph.nodes) == 1
    assert graph.edges == []
