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

## v1 backfill, round 2: confidence, catalog, dataset summary

A third, still-more-detailed spec pass surfaced a few more gaps, closed here:

- **Median and standard deviation** added to every numeric column's stats
  (alongside the existing min/max/mean/sum), and a **"Percentage"**
  semantic label for columns named like `discount_pct` / `growth_rate`.
- **Confidence scores on semantic labels** — a regex pattern match is
  0.9, a fallback to title-casing the raw column name (no pattern
  matched) is 0.4. The label is a suggestion, not a fact, and the
  frontend shows the confidence next to it.
- **Editable semantic labels** — click any inferred label in the schema
  table to correct it. `PATCH /api/datasets/{id}/columns/{name}` persists
  the correction (confidence jumps to 1.0) and also patches the live
  in-session cache, so simulate/insights/ask reflect it immediately
  without a re-upload.
- **Metadata Catalog** (`backend/catalog.py`) — the first real
  persistence layer in NEXUS, using SQLite (stdlib, no extra service —
  matches the local-first pattern everything else here follows). Stores
  dataset metadata (filename, upload time, row/column count, domain,
  quality score, full schema including any label corrections) so it
  survives a restart. **Scope limit, stated plainly**: this stores
  metadata, not the raw uploaded file or its DataFrame — the `/catalog`
  page lets you review and correct past analyses, but re-running charts
  or simulations against an old entry still requires re-uploading that
  file, since the in-memory DataFrame cache (`_ANALYSIS_DF_CACHE`) is
  separate and ephemeral by design.
- **AI Dataset Summary** (`POST /api/summary`) — a single grounded
  overview paragraph (what the data appears to contain, its size, the
  quality score, what kind of analysis the columns support), distinct
  from the bullet-point insights list — same "compute first, LLM
  narrates only what's given" rule as everywhere else.

## v2 upgrade: rigorous statistics (`backend/relationships.py`, `distributions.py`, `anomalies_ml.py`, `insight_ranking.py`, `insight_timeline.py`)

A fourth spec pass asked for real statistical rigor rather than plain
correlation coefficients and effect sizes. Kendall correlation and DBSCAN
were explicitly marked optional in that spec and are skipped; everything
else is implemented:

- **Correlation method selection** — Pearson by default, switching to
  Spearman (rank-based, no linearity/normality assumption) when either
  column is heavily skewed (`|skew| > 1`). Every reported correlation now
  carries a p-value and a `significant` flag (p < 0.05), not just `r`.
- **Root cause significance testing** — `root_cause_breakdown()` now runs
  a real one-way ANOVA when the metric looks roughly normal within
  groups, or Kruskal-Wallis (rank-based) when it's skewed, alongside the
  existing eta-squared effect size. Both the test statistic and p-value
  are reported per dimension.
- **Distribution analysis** (`backend/distributions.py`) — mean, median,
  mode, variance, std, skewness, excess kurtosis (Fisher definition),
  and percentiles (p10/p25/p50/p75/p90) for every numeric column, plus a
  simple threshold-based shape classification (`approximately_normal` /
  `right_skewed` / `left_skewed` / `heavy_tailed`).
- **Anomaly method selection** — the existing per-column check now picks
  Z-score (assumes normality, 3σ threshold) for roughly-normal columns
  and falls back to the distribution-free IQR test for skewed ones,
  tagging each anomaly with which method flagged it.
- **Multivariate anomalies** (`backend/anomalies_ml.py`) — Isolation
  Forest across all numeric columns at once, catching rows that are
  unremarkable in any single column but unusual in combination (e.g.
  high revenue paired with an unusually low order count). Requires at
  least 15 rows and 2 numeric columns; returns nothing below that rather
  than running an unreliable model on too little data.
- **Ranked findings / Insight Explorer** (`backend/insight_ranking.py`) —
  rather than asking an LLM to rank its own prose, this assembles the
  deterministic findings above (correlations, associations, root-cause
  dimensions, anomalies) into one list scored by a documented composite
  of magnitude and significance. The frontend's Insight Explorer renders
  each as a clickable row that expands to the full evidence JSON — no
  black-box ranking.
- **Insight timeline** (`backend/insight_timeline.py`) — one entry per
  time period, but only when something is actually notable there (a
  detected spike, or a ≥15% swing vs. the prior period). Deliberately
  sparse: a quiet month gets no entry rather than a fabricated one.

Natural-language questions like "why is revenue decreasing?" or "which
region performs best?" were already covered by the `POST /api/ask`
pipeline built in the earlier v2 backfill (classify intent → compute
deterministically → narrate only the computed result) — no new work was
needed there.

## v3 upgrade: real model competition, target discovery, threshold alerts

A fifth spec pass asked for genuine predictive-model competition rather
than three simple statistical methods. Prophet and XGBoost were flagged
as unreliable to install on Windows earlier in this project — that was
re-tested, and both actually install and run fine here now, so they were
added for real rather than substituted again.

- **Six real candidates** backtested per forecast (`backend/forecasting.py`):
  naive, linear trend, Holt's exponential smoothing, Random Forest,
  XGBoost, and Prophet. Whichever has the lowest validation RMSE on a
  held-out tail is chosen and refit on the full series. On the smooth
  trending series this was tested against, Holt won and the tree models
  (Random Forest, XGBoost) scored honestly worse — they can't extrapolate
  a trend past the range they were trained on, a real, known limitation
  the backtest surfaces rather than hides.
- **R² added** alongside RMSE/MAE/MAPE, plus explicit training-period and
  validation-period date ranges attached to every forecast's validation
  block.
- **Automatic target discovery** (`discover_forecastable_targets()`) —
  every numeric column is evaluated as a potential forecast target with
  a confidence score (based on how many time periods are available), not
  just the first one. `POST /api/forecast` lets the frontend forecast any
  of them on demand using the cached DataFrame, without re-uploading.
- **Forecast comparison table** — the frontend renders every candidate
  model's MAPE/RMSE/R² side by side with a checkmark on the one selected,
  plus the exact train/validation date ranges used.
- **Threshold-crossing risk alerts** (`backend/risk_alerts.py`) — for a
  metric semantically labeled `Quantity` (a reasonable stand-in for
  inventory/stock — there's no dataset-specific "critical level" to
  assume otherwise), if the forecast trend is down, this computes exactly
  how many periods until the linear projection crosses zero via
  interpolation between forecast points. Verified against a synthetic
  declining-inventory series: correctly flagged ~0.3 periods until
  stockout, matching the interpolation by hand.
- **Dedicated forecast explanation** (`POST /api/forecast/explain`,
  `generate_forecast_explanation()`) — separate from the general insights
  narrator, grounded specifically in the chosen model, its validation
  metrics vs. the alternatives, and the prediction interval; explicitly
  told to cite the actual MAPE/R² rather than invent a reliability claim.

Kendall correlation and DBSCAN remain skipped from the v2 pass (marked
optional there); nothing new in this v3 pass was skipped.

## v5: knowledge graph & multi-table intelligence

This is the first version where NEXUS analyzes a *set* of related tables
instead of one file — and the first version with real database
infrastructure: **PostgreSQL 17** and **Neo4j 5.26 Community**, both
installed natively on Windows (not Docker — see below). SQLite still
backs the single-table catalog from earlier versions; Postgres is
provisioned and ready but nothing has been migrated to it yet.

**Multi-file upload** (`POST /api/workspace`) accepts several CSV/Excel
files at once, builds a schema for each (reusing v1's `schema_inference`
unchanged), and caches them in a workspace, separate from the
single-table `analysis_id` cache used everywhere else.

**Relationship discovery** (`backend/multi_table.py`) — never assumes a
join. For every candidate column pair (matching by name, or a column
named like `CustomerID` against a table named `Customers`), it measures
actual value overlap between the two columns and only proposes a
relationship above a confidence threshold, with the evidence (overlap %,
whether the target column looks like a primary key) attached. Verified
against a Sales/Customers/Products sample: correctly found both real
foreign keys (`Sales.CustomerID → Customers.CustomerID`,
`Sales.ProductID → Products.ProductID`) at 100% confidence with zero
false positives.

**Review step** — suggested relationships are returned to the frontend
for confirmation before anything is built; `POST /api/workspace/{id}/relationships`
only ingests what the user confirmed.

**Knowledge graph builder** (`backend/knowledge_graph_builder.py`) —
ingests each table's rows as Neo4j nodes (one node per row, labeled by
table name) and confirmed relationships as edges, via batched `UNWIND`
writes. Capped at 2,000 rows/table by design: this is a live
request/response tool, not a batch ETL pipeline. A parallel NetworkX
graph is built from the same data for analytics.

**Graph analytics** (`backend/graph_analytics.py`) — PageRank, degree
centrality, and connected components via NetworkX. Verified against the
sample data: correctly ranked the customer and product appearing in the
most orders as most influential, and correctly isolated a customer whose
only purchase was an otherwise-unbought product as its own disconnected
component (checked by hand against the raw CSV).

**Entity profiles** (`GET /api/workspace/{id}/entity/{table}/{key}`) —
live Cypher query against Neo4j returning a node's properties and 1-hop
neighbors. Verified: querying a customer correctly returned their exact
order history.

**Frontend** (`/workspace`) — multi-file drop zone → relationship
review checklist → "Build Knowledge Graph" → a graph explorer
(`@xyflow/react`, entities clustered by table with a circular layout)
where clicking a node loads its live entity profile, plus a graph
analytics panel.

**Scope, stated plainly** (matches the "never invent relationships"
principle from the spec):
- No text-to-Cypher, no LangGraph/LlamaIndex orchestration, no GraphRAG.
  Natural-language questions over the graph aren't supported yet — that
  would extend the existing `/api/ask` classify-then-compute pattern to
  graph traversal, not a separate LLM-driven query engine, and wasn't
  built this round.
- Community detection beyond connected-components, and a relationship
  timeline, weren't built (both were marked as lower-priority in the
  original scoping discussion for this version).
- Entities are ingested at the row level (real per-instance nodes, not
  just table-level schema nodes), but capped per table — a genuine
  multi-million-row warehouse load needs a background job, which this
  synchronous endpoint doesn't attempt.

### Getting PostgreSQL + Neo4j running (native Windows, no Docker)

Both were installed directly on Windows via `winget`/direct download
rather than Docker or WSL2 — WSL2's networking turned out to be broken
on this machine (DNS resolved, TCP handshakes completed, but all
response data silently dropped — not fixed by mirrored networking mode,
MTU changes, or disabling the firewall; root cause never fully
identified). If you hit the same wall, native installers are the
pragmatic fallback:

- **PostgreSQL**: `winget install PostgreSQL.PostgreSQL.17` (or the
  interactive EDB installer from postgresql.org — note their download
  CDN blocks default `curl`/PowerShell user agents as bot traffic; add a
  browser-like `User-Agent` header if scripting the download).
- **Neo4j**: needs a JVM first (`winget install Microsoft.OpenJDK.21`),
  then download the Community Server zip directly from
  `neo4j.com/artifact.php?name=neo4j-community-5.26.0-windows.zip` (the
  `neo4j.com` mirror redirect worked fine; `archive.ubuntu.com`-style
  default mirrors are unrelated and not needed here), extract it, and
  either run `neo4j.bat console` directly (what this project currently
  does — a foreground/background process, not a service) or
  `neo4j.bat windows-service install` if you have admin rights to start
  Windows services.

Both are configured via `.env` (`NEO4J_URI`/`NEO4J_USER`/`NEO4J_PASSWORD`,
`POSTGRES_DSN`) — see `.env.example`.

## Additive ML stack (post-v5)

A later stack-alignment request asked for the full "final tech stack"
list (DuckDB, Polars, Apache ECharts, shadcn/ui, Zustand, TanStack Query,
Celery/Redis, Clerk auth, Kubernetes, etc.) to be retrofitted everywhere.
Most of that was declined — swapping pandas for DuckDB/Polars,
Recharts for ECharts, or `useState`/`fetch` for Zustand/TanStack Query
would mean rewriting every working, tested module for zero new
capability, which is exactly the kind of premature-refactor churn this
project has avoided everywhere else. What *did* get adopted is the
genuinely additive part of that list — new capabilities, not
reformatted old ones:

- **LightGBM** — a seventh forecast candidate in `forecasting.py`,
  competing honestly alongside naive/linear/Holt/RF/XGBoost/Prophet in
  the same backtest.
- **SHAP** — explains *why* Isolation Forest flagged a row as anomalous
  (`backend/anomalies_ml.py`), via `TreeExplainer` on the fitted model —
  verified it correctly attributes an outlier month's anomaly score to
  its Revenue/Inventory/Orders values.
- **Local Outlier Factor + One-Class SVM** — `anomalies_ml.py` now runs
  three multivariate anomaly methods and reports **consensus** (how many
  agree on a given row) as an honest confidence signal, instead of
  trusting a single method's score.
- **KMeans clustering** (`backend/clustering.py`) — row segmentation
  with K chosen automatically via silhouette score across a small
  candidate range, not assumed; returns nothing if the data has no real
  cluster structure rather than forcing a split.
- **Great Expectations** (`backend/ge_validation.py`) — a supplementary
  *structural* validation layer (row count, id uniqueness, excessive
  nulls) that runs alongside, not instead of, the existing
  business-meaning-aware quality report from v1. Adds real latency
  (~2-3s per analyze call, mostly GE's own context/import overhead) —
  a known, accepted tradeoff for a synchronous request.

Frontend gains `ClusteringPanel`, `GEValidationPanel`, and
`MultivariateAnomaliesPanel` now shows consensus + SHAP feature impacts;
`ForecastComparisonTable`/`ForecastChart` know about the LightGBM label.
