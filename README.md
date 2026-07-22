# NEXUS

**Upload anything. Understand everything.**

Universal analytics: upload a CSV/Excel/JSON file and NEXUS infers column
types, guesses each column's real-world meaning, guesses the dataset's
industry/domain, and generates a dashboard — no configuration.

This is **v1-v4** of a larger roadmap:

- **v1 (done)** — universal upload, schema/semantic inference, auto dashboard
- **v2 (done)** — semantic knowledge graph + AI-generated insights
- **v3 (done)** — forecasting, anomaly detection, recommendations
- **v4 (done)** — decision simulation engine (schema-aware "what-if" decisions,
  correlation/regression-based propagation, decision graph, scenario comparison)
- v5 — 3D data exploration, AI research reports, collaboration

## Stack

- **Backend**: FastAPI + pandas + numpy (heuristic schema inference and
  statistical forecasting/anomaly detection, no trained ML model)
- **LLM layer**: any OpenAI-compatible endpoint (defaults to a local
  [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi) router) for
  AI-generated insights and recommendations
- **Frontend**: Next.js + TypeScript + Tailwind + Recharts + @xyflow/react

## Running locally

**Backend** (Python 3.11+):

```bash
cd backend
python -m venv venv
./venv/Scripts/activate   # or `source venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env      # fill in FREELLMAPI_API_KEY to enable AI insights
uvicorn main:app --port 8001
```

**Frontend** (Node 20+):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000, drop in a CSV (try `backend/sample_retail.csv`),
and the dashboard renders automatically.

## How the inference works (v1)

`backend/schema_inference.py` is pure heuristics — no LLM calls, no trained
model:

1. **Column type** — regex on the column name plus a look at the actual
   values (parseable as a date? mostly numeric? low cardinality?) decides
   `id` / `numeric` / `date` / `categorical` / `boolean` / `text`.
2. **Semantic label** — a small table of regex patterns maps raw column
   names (`Cust_ID`, `Amt`, `Purchase_Date`) to human labels (`Customer ID`,
   `Monetary Amount`, `Transaction Date`).
3. **Domain guess** — keyword voting across all column names picks the
   closest industry (Healthcare, Retail, Education, Finance, Manufacturing,
   Logistics) or falls back to "General".
4. **Chart suggestions** — KPI cards from numeric sums, bar charts from
   categorical value counts, and a line chart pairing the first date column
   with the first numeric column (monthly aggregation).

This is intentionally simple so v1 ships fast; swapping in a trained
classifier or an LLM-based column tagger later doesn't change the API shape
(`/api/analyze` returns the same `schema` + `charts` JSON either way).

## v2: knowledge graph + AI insights

`backend/graph_builder.py` turns the schema into a star-schema graph — a
root "dataset" node fanning out to entity/dimension/time/measure nodes,
rendered in the frontend with `@xyflow/react`. `POST /api/insights` sends
a stats-only summary of the dataset (never raw rows) to an OpenAI-compatible
LLM router and returns a short list of confidence-rated insights.

## v3: forecasting, anomalies, recommendations

`backend/analytics.py` adds two statistical passes, both computed
synchronously as part of `/api/analyze`:

- **Anomalies** — an IQR outlier test per numeric column (values outside
  `[Q1 - 1.5*IQR, Q3 + 1.5*IQR]`), returned with the row's identifier.
- **Forecast** — an ordinary-least-squares linear trend fit over the same
  monthly-aggregated series used for the v1 line chart, projected 3 periods
  ahead with a residual-based uncertainty band.

Both anomalies and the forecast trend are fed into the same `/api/insights`
LLM call, so recommendations come back grounded in what was actually
detected rather than generic advice.

## v4: decision simulation engine

The core principle: **NEXUS never invents information the data doesn't
support.** There is no fixed list of "business actions" (hire employees,
increase marketing spend, delay a supplier) — `build_decision_actions()` in
`backend/simulation.py` only offers a decision for a numeric column that
was actually detected in the upload. Upload a dataset with no employee
data, and there is no hiring scenario.

`SimulationEngine` is a `Protocol` (see `backend/simulation.py`) so the
propagation method itself can be swapped later — a Bayesian network, a
structural causal model, a multi-table digital twin — without touching
`/api/simulate` or the frontend. The v4 implementation,
`CorrelationRegressionEngine`, is deliberately simple and explainable:

1. Changing a driver column by X% scales its historical sum by X%.
2. For every other numeric column, fit an ordinary-least-squares line
   against the driver across paired historical rows, and project the new
   sum through that fitted line.
3. Report **R² as the confidence** in that association, and always label
   the result an association, not a causal claim (a fixed disclaimer is
   attached to every `SimulationResult`, independent of whether the LLM
   explanation step succeeds).

`POST /api/analyze` caches the parsed DataFrame in memory (keyed by
`analysis_id`) so `POST /api/simulate` can re-run regressions without
re-uploading the file — fine for a local single-user tool, lost on
restart.

Four scenario presets (Conservative Growth, Optimistic, Aggressive
Expansion, Economic Downturn) are just different magnitudes/directions
applied to the same primary metric through the *same* engine — no separate
logic. `POST /api/simulate/explain` asks the LLM to narrate the computed
deltas and confidence values; the prompt explicitly forbids inventing
business reasoning beyond what the statistics show.

The frontend's Decision Graph (`@xyflow/react`) is the centerpiece: each
node shows the projected delta, and each edge is labeled with the R² and
association direction, so the estimate is inspectable rather than a
black box.

## v1-v3 backfill

The original v1-v3 above were lean heuristic-first passes. A second, more
rigorous specification of what those versions should cover surfaced real
gaps — closed here without changing anything already built:

**v1 — profiling (`backend/profiling.py`)**
- Duplicate row detection, plus rule-based invalid-value checks (negative
  values in columns where that's implausible — Quantity, Monetary Amount,
  Age; duplicate IDs in an `id` column; inconsistent capitalization within
  a categorical column).
- A deterministic 0-100 data quality score (start at 100, subtract capped
  penalties for missingness/duplicates/invalid values — the exact formula
  is in `compute_quality_score()`, not a black box).
- Rule-based recommendations (e.g. "18% missing → median imputation") —
  presented for the user to act on, nothing is auto-applied to the data.
- Expanded the semantic-label pattern list (`Client_ID`, `Invoice Date`,
  `Phone Number`, `Age`, `Gender`, etc.) and added cardinality labels
  (`unique`/`high`/`medium`/`low`) to each column's stats.
- KPIs now include an average alongside the sum, and an "Unique {Entity}s"
  count when an id column exists — still schema-driven, nothing invented.

**v2 — relationships and root cause (`backend/relationships.py`, `backend/qa.py`)**
- `numeric_correlations()` — pairwise Pearson correlation across all
  numeric columns (not just the one pair you happen to pick in the
  simulator), filtered to `|r| >= 0.3`.
- `categorical_associations()` — Cramér's V from a manually-computed
  contingency table (no scipy dependency), filtered to `V >= 0.1`.
- `root_cause_breakdown()` — eta-squared variance decomposition: for the
  primary metric, how much of its variance does each categorical
  dimension explain, and which segment deviates most from the mean.
  Matches the "Region explains 62%" framing directly, labeled an
  association throughout.
- `period_over_period()` and `detect_time_series_spikes()` /
  `detect_seasonality()` in `backend/analytics.py` — month-over-month
  comparison, trend-residual spike detection, and lag-based
  autocorrelation for yearly seasonality (honestly reports
  `insufficient_data` below two full cycles rather than guessing).
- **Natural-language Q&A** (`POST /api/ask`) — a real compute-then-narrate
  pipeline: one LLM call classifies the question into a fixed intent
  (trend / compare_periods / top_category / correlation / root_cause /
  summary) and extracts column names, validated against the actual
  schema before use; the backend runs the matching deterministic
  computation; a second LLM call narrates *only* that computed result,
  explicitly told to say so if it doesn't actually answer the question.

**v3 — model selection and risk alerts (`backend/forecasting.py`, `backend/risk_alerts.py`)**
- Forecast eligibility is now always reported (`forecast_eligibility` on
  `/api/analyze`), including the case where there's no date column at
  all — the frontend explains why forecasting isn't available instead of
  silently showing nothing.
- **Automatic model selection**: candidates (naive carry-forward, linear
  trend, Holt's linear exponential smoothing) are backtested on a
  held-out tail of the series, and whichever has the lowest validation
  RMSE is chosen and refit on the full series. Below 6 periods there
  isn't enough data to backtest honestly, so it falls back to linear
  trend and says so.
  *(Prophet and XGBoost were in the original ask and were substituted:
  Prophet's build toolchain is fragile on Windows without a C++ compiler,
  and gradient-boosted trees are overkill for a handful of monthly
  points — Holt's method covers the same "trend + smoothing" ground.)*
- **Validation metrics** — RMSE/MAE/MAPE from the actual holdout
  backtest are reported per candidate, not just for the winner.
- **Future risk alerts** (`backend/risk_alerts.py`) — generated
  deterministically from the forecast trend and validation MAPE (turned
  into a confidence %), plus the root-cause breakdown for the same
  metric when available for a "primary driver." Not LLM-generated.
