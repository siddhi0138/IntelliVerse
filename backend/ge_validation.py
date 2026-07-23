"""V1 additive: Great Expectations as a supplementary structural sanity
check, layered on top of (not replacing) profiling.py's own quality
report. GE's checks here are generic/structural (row count, id
uniqueness, excessive nulls) — profiling.py's checks are business-
meaning-aware (a negative Quantity, inconsistent category casing).
Neither replaces the other; both run and are reported separately.

If GE itself errors for any reason, this reports `available: false` with
the reason rather than failing the whole analyze request — this is a
supplementary check, not a required one.
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from schema_inference import ColumnSchema


def run_validation(df: pd.DataFrame, schema: list[ColumnSchema]) -> dict[str, Any]:
    try:
        import great_expectations as gx  # lazy: heavy import, only paid for when this actually runs

        context = gx.get_context(mode="ephemeral")
        data_source = context.data_sources.add_pandas("nexus_pandas")
        asset = data_source.add_dataframe_asset(name="nexus_asset")
        batch_def = asset.add_batch_definition_whole_dataframe("nexus_batch")
        batch = batch_def.get_batch(batch_parameters={"dataframe": df})

        suite = gx.ExpectationSuite(name="nexus_suite")
        suite.add_expectation(gx.expectations.ExpectTableRowCountToBeBetween(min_value=1))

        for col in schema:
            if col.type == "id":
                suite.add_expectation(gx.expectations.ExpectColumnValuesToBeUnique(column=col.name))
            elif col.type == "numeric":
                suite.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column=col.name, mostly=0.5))

        result = batch.validate(suite)

        failed = [
            {
                "expectation": r.expectation_config.type,
                "column": r.expectation_config.kwargs.get("column"),
                "unexpected_count": r.result.get("unexpected_count"),
                "unexpected_percent": r.result.get("unexpected_percent"),
            }
            for r in result.results
            if not r.success
        ]

        return {
            "available": True,
            "success": result.success,
            "expectations_run": len(result.results),
            "failed": failed,
        }
    except Exception as exc:
        return {"available": False, "reason": str(exc)}
