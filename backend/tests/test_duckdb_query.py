import pandas as pd
import pytest

from duckdb_query import UnsafeQueryError, run_query


@pytest.fixture
def sales_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "Region": ["North", "South", "East", "West"],
            "Revenue": [1000, 2000, 1500, 3000],
        }
    )


def test_simple_select_returns_expected_rows(sales_df):
    result = run_query(sales_df, "SELECT * FROM df WHERE Revenue > 1200")
    assert result["row_count"] == 3
    assert set(result["columns"]) == {"Region", "Revenue"}
    assert result["truncated"] is False


def test_aggregate_query_works(sales_df):
    result = run_query(sales_df, "SELECT SUM(Revenue) AS total FROM df")
    assert result["rows"][0][0] == 7500


def test_with_cte_is_allowed(sales_df):
    result = run_query(sales_df, "WITH t AS (SELECT * FROM df) SELECT COUNT(*) AS n FROM t")
    assert result["rows"][0][0] == 4


def test_null_values_are_converted_to_none(sales_df):
    df = sales_df.copy()
    df.loc[0, "Revenue"] = None
    result = run_query(df, "SELECT Revenue FROM df ORDER BY Region")
    assert None in [row[0] for row in result["rows"]]


def test_max_rows_truncates_and_flags_it(sales_df):
    result = run_query(sales_df, "SELECT * FROM df", max_rows=2)
    assert result["row_count"] == 2
    assert result["truncated"] is True


@pytest.mark.parametrize(
    "sql",
    [
        "DROP TABLE df",
        "DELETE FROM df",
        "INSERT INTO df VALUES (1, 2)",
        "UPDATE df SET Revenue = 0",
        "ALTER TABLE df ADD COLUMN x INT",
        "ATTACH 'evil.db' AS evil",
        "PRAGMA database_list",
        "INSTALL httpfs",
        "COPY df TO 'out.csv'",
        "CALL some_procedure()",
    ],
)
def test_disallowed_statement_keywords_are_rejected(sales_df, sql):
    with pytest.raises(UnsafeQueryError):
        run_query(sales_df, sql)


def test_non_select_statement_is_rejected(sales_df):
    with pytest.raises(UnsafeQueryError, match="Only SELECT"):
        run_query(sales_df, "EXPLAIN SELECT * FROM df")


def test_multiple_statements_are_rejected(sales_df):
    with pytest.raises(UnsafeQueryError, match="single statement"):
        run_query(sales_df, "SELECT * FROM df; SELECT * FROM df")


def test_empty_query_is_rejected(sales_df):
    with pytest.raises(UnsafeQueryError, match="Empty query"):
        run_query(sales_df, "   ")


def test_forbidden_keyword_inside_a_select_is_still_caught(sales_df):
    # A forbidden keyword appearing anywhere in the statement (not just as
    # the leading verb) must still be blocked, e.g. a nested DDL attempt.
    with pytest.raises(UnsafeQueryError):
        run_query(sales_df, "SELECT * FROM df WHERE Region = (SELECT 'x'); DROP TABLE df")


def test_invalid_sql_syntax_raises_unsafe_query_error_not_a_raw_exception(sales_df):
    with pytest.raises(UnsafeQueryError, match="Query failed"):
        run_query(sales_df, "SELECT FROM WHERE")


def test_referencing_a_nonexistent_column_raises_unsafe_query_error(sales_df):
    with pytest.raises(UnsafeQueryError):
        run_query(sales_df, "SELECT NoSuchColumn FROM df")
