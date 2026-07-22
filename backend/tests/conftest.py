"""Shared fixtures for the backend test suite.

Tests run against pandas DataFrames built in-memory (no file I/O), so
they're fast and don't depend on the sample CSVs used for manual
verification during development. LLM-touching modules (insights.py,
qa.py, autonomous_analyst.py, simulation's explain step) are tested with
the LLM call mocked — these tests check the deterministic parts (prompt
construction, response parsing), not FreeLLMAPI itself.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture
def business_df() -> pd.DataFrame:
    """18 months of growing revenue/orders/customers/profit — mirrors
    sample_business.csv used for manual verification, so test
    expectations can be cross-checked against those earlier curl runs."""
    return pd.DataFrame(
        {
            "Order_Date": pd.date_range("2023-01-03", periods=18, freq="MS"),
            "Region": (["North", "South", "East", "West"] * 5)[:18],
            "Category": (["Electronics", "Clothing", "Groceries"] * 6)[:18],
            "Revenue": [12000 + i * 500 for i in range(18)],
            "Orders": [120 + i * 5 for i in range(18)],
            "Customers": [95 + i * 2 for i in range(18)],
            "Profit": [2400 + i * 150 for i in range(18)],
        }
    )


@pytest.fixture
def dirty_df() -> pd.DataFrame:
    """Deliberately messy: a duplicate row, a negative Quantity, and
    inconsistent categorical casing — mirrors sample_dirty.csv."""
    return pd.DataFrame(
        {
            "Order_ID": ["O001", "O002", "O003", "O004", "O005", "O005", "O006", "O007", "O008", "O009"],
            "Customer_ID": ["C001", "C002", "C003", "C004", "C005", "C005", "C001", "C007", "C008", "C009"],
            "Order_Date": pd.to_datetime(
                [
                    "2024-01-05", "2024-01-12", "2024-02-02", "2024-02-15", "2024-03-01",
                    "2024-03-01", "2024-03-10", "2024-03-22", "2024-04-02", "2024-04-18",
                ]
            ),
            "Region": ["North", "south", "North", "East", "West", "West", "North", "South", "East", "North"],
            "Quantity": [10, 5, -3, 8, 4, 4, 12, 6, 7, 15],
            "Amount": [120.50, 45.00, 300.00, None, 89.99, 89.99, 220.00, 60.00, 150.00, 500.00],
        }
    )


@pytest.fixture
def multi_table_dfs() -> dict[str, pd.DataFrame]:
    """Sales/Customers/Products with two genuine foreign keys — mirrors
    backend/sample_multi/*.csv used for v5 manual verification."""
    customers = pd.DataFrame(
        {
            "CustomerID": ["C001", "C002", "C003", "C004", "C005"],
            "Name": ["Alice Smith", "Bob Jones", "Carol White", "David Brown", "Eve Davis"],
            "Region": ["North", "South", "East", "West", "North"],
        }
    )
    products = pd.DataFrame(
        {
            "ProductID": ["P001", "P002", "P003", "P004", "P005"],
            "ProductName": ["Laptop", "Headphones", "Desk Chair", "Monitor", "Standing Desk"],
            "Category": ["Electronics", "Electronics", "Furniture", "Electronics", "Furniture"],
            "Price": [1200, 150, 220, 300, 450],
        }
    )
    sales = pd.DataFrame(
        {
            "OrderID": [f"O{str(i).zfill(3)}" for i in range(1, 11)],
            "CustomerID": ["C001", "C002", "C001", "C003", "C004", "C005", "C002", "C001", "C003", "C004"],
            "ProductID": ["P001", "P002", "P004", "P003", "P001", "P005", "P001", "P002", "P004", "P003"],
            "Quantity": [1, 2, 1, 1, 1, 1, 1, 3, 2, 1],
        }
    )
    return {"Sales": sales, "Customers": customers, "Products": products}
