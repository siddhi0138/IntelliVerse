from schema_inference import build_schema, guess_domain


def test_infers_types(business_df):
    schema = build_schema(business_df)
    by_name = {c.name: c for c in schema}

    assert by_name["Order_Date"].type == "date"
    assert by_name["Region"].type == "categorical"
    assert by_name["Revenue"].type == "numeric"


def test_semantic_labels_match_regex_get_high_confidence(business_df):
    schema = build_schema(business_df)
    by_name = {c.name: c for c in schema}

    assert by_name["Revenue"].semantic_label == "Monetary Amount"
    assert by_name["Revenue"].confidence == 0.9
    assert by_name["Region"].semantic_label == "Geography"


def test_unmatched_column_name_falls_back_to_title_case_with_low_confidence():
    import pandas as pd

    df = pd.DataFrame({"XyzUnrecognizedColumn": [1, 2, 3, 4, 5]})
    schema = build_schema(df)
    assert schema[0].semantic_label == "Xyzunrecognizedcolumn"
    assert schema[0].confidence == 0.4


def test_numeric_stats_include_median_and_std(business_df):
    schema = build_schema(business_df)
    revenue = next(c for c in schema if c.name == "Revenue")
    assert "median" in revenue.stats
    assert "std" in revenue.stats
    assert revenue.stats["sum"] == business_df["Revenue"].sum()


def test_cardinality_label_for_unique_id_column():
    import pandas as pd

    df = pd.DataFrame({"OrderID": [f"O{i}" for i in range(20)]})
    schema = build_schema(df)
    assert schema[0].stats["cardinality"] == "unique"


def test_guess_domain_retail():
    assert guess_domain(["CustomerID", "OrderID", "ProductID", "Discount"]) == "Retail / E-commerce"


def test_guess_domain_falls_back_when_no_keywords_match():
    assert guess_domain(["Foo", "Bar", "Baz"]) == "General / Unclassified"
