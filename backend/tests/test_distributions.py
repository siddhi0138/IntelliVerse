import numpy as np
import pandas as pd
import pytest

from distributions import analyze_distributions, classify_shape, compute_distribution
from schema_inference import ColumnSchema


def test_classify_shape_thresholds():
    assert classify_shape(skewness=0.0, excess_kurtosis=2.0) == "heavy_tailed"
    assert classify_shape(skewness=0.8, excess_kurtosis=0.0) == "right_skewed"
    assert classify_shape(skewness=-0.8, excess_kurtosis=0.0) == "left_skewed"
    assert classify_shape(skewness=0.1, excess_kurtosis=0.1) == "approximately_normal"
    # heavy_tailed takes priority even alongside a skew that alone would
    # classify as right/left-skewed
    assert classify_shape(skewness=0.9, excess_kurtosis=1.5) == "heavy_tailed"


def test_compute_distribution_on_uniform_symmetric_values():
    values = pd.Series([10, 20, 30, 40, 50])
    result = compute_distribution(values)
    assert result["mean"] == 30.0
    assert result["median"] == 30.0
    assert result["percentiles"]["p50"] == 30.0
    assert result["shape"] == "approximately_normal"


def test_compute_distribution_flags_right_skew():
    # A handful of small values plus one huge outlier - classic right skew.
    values = pd.Series([1, 2, 2, 3, 3, 4, 100])
    result = compute_distribution(values)
    assert result["skewness"] > 0.5
    assert result["shape"] in ("right_skewed", "heavy_tailed")


def test_compute_distribution_returns_none_below_minimum_sample_size():
    assert compute_distribution(pd.Series([1, 2, 3])) is None


def test_compute_distribution_ignores_nan_values():
    values = pd.Series([10, 20, 30, 40, 50, np.nan, np.nan])
    result = compute_distribution(values)
    assert result is not None
    assert result["mean"] == 30.0


def test_compute_distribution_handles_zero_variance():
    # All-identical values: std is 0, so skew/kurtosis must short-circuit
    # to 0.0 rather than dividing by zero.
    values = pd.Series([5, 5, 5, 5, 5])
    result = compute_distribution(values)
    assert result["skewness"] == 0.0
    assert result["excess_kurtosis"] == 0.0
    assert result["std"] == 0.0
    assert result["shape"] == "approximately_normal"


def test_analyze_distributions_only_processes_numeric_columns():
    df = pd.DataFrame(
        {
            "Revenue": [100, 200, 300, 400, 500, 600],
            "Region": ["N", "S", "E", "W", "N", "S"],
        }
    )
    schema = [
        ColumnSchema(name="Revenue", type="numeric", semantic_label="Revenue"),
        ColumnSchema(name="Region", type="categorical", semantic_label="Region"),
    ]
    result = analyze_distributions(df, schema)
    assert set(result.keys()) == {"Revenue"}


def test_analyze_distributions_coerces_currency_strings():
    df = pd.DataFrame({"Amount": ["$1,200.00", "$2,300.50", "$3,100.00", "$4,050.25", "$5,000.00"]})
    schema = [ColumnSchema(name="Amount", type="numeric", semantic_label="Amount")]
    result = analyze_distributions(df, schema)
    assert result["Amount"]["mean"] == pytest.approx(3130.15, rel=1e-3)
