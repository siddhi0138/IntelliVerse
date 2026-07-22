from multi_table import discover_relationships
from schema_inference import build_schema


def test_discovers_both_real_foreign_keys(multi_table_dfs):
    schemas = {name: build_schema(df) for name, df in multi_table_dfs.items()}
    candidates = discover_relationships(multi_table_dfs, schemas)

    pairs = {(c.from_table, c.from_column, c.to_table, c.to_column) for c in candidates}
    assert ("Sales", "CustomerID", "Customers", "CustomerID") in pairs
    assert ("Sales", "ProductID", "Products", "ProductID") in pairs


def test_real_foreign_keys_have_full_confidence_and_overlap(multi_table_dfs):
    schemas = {name: build_schema(df) for name, df in multi_table_dfs.items()}
    candidates = discover_relationships(multi_table_dfs, schemas)

    customer_fk = next(c for c in candidates if c.to_table == "Customers")
    assert customer_fk.confidence == 1.0
    assert customer_fk.overlap_pct == 100.0
    assert customer_fk.to_column_is_unique is True
    assert customer_fk.relationship_type == "many_to_one"


def test_no_spurious_relationships_between_unrelated_columns(multi_table_dfs):
    schemas = {name: build_schema(df) for name, df in multi_table_dfs.items()}
    candidates = discover_relationships(multi_table_dfs, schemas)

    # Region (Customers) and Category (Products) share no key relationship
    assert not any(
        {c.from_column, c.to_column} == {"Region", "Category"} for c in candidates
    )
