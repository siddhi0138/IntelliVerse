# NEXUS

**Upload anything. Understand everything.**

Universal analytics: upload a CSV/Excel/JSON file and NEXUS infers column
types, guesses each column's real-world meaning, guesses the dataset's
industry/domain, and generates a dashboard — no configuration.

This is **v1-v3** of a larger roadmap:

- **v1 (done)** — universal upload, schema/semantic inference, auto dashboard
- **v2 (done)** — semantic knowledge graph + AI-generated insights
- **v3 (done)** — forecasting, anomaly detection, recommendations
- v4 — digital twin + scenario simulation
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
