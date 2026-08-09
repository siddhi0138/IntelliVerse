<div align="center">

# 🧠 IntelliVerse - Autonomous Decision Intelligence

**Upload anything. Understand everything.**

Drop in a CSV, Excel, or JSON file. IntelliVerse infers what the columns mean,
guesses the domain, and runs a full statistical + ML pipeline against it —
then hands the results, not raw data, to an LLM to explain in plain English.
No configuration, no manual column mapping, no invented numbers.

![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Neo4j](https://img.shields.io/badge/Neo4j-018bff?logo=neo4j&logoColor=white)

</div>

## 📚 Contents

- [🧩 What actually happens when you upload a file](#what-actually-happens-when-you-upload-a-file)
- [🎯 Design principle](#design-principle-compute-first-narrate-second)
- [✨ Features](#features)
- [🧪 Worked example](#worked-example--a-real-run-not-a-mockup)
- [📏 Measured, not claimed](#measured-not-claimed)
- [🛠️ Tech stack](#tech-stack)
- [🚀 Getting started](#getting-started)
- [🐳 Docker](#docker)
- [📊 Observability](#observability)
- [☁️ Deployment](#deployment)
- [🧪 Testing](#testing)
- [📁 Project structure](#project-structure)
- [🤝 Contributing](#contributing)

## What actually happens when you upload a file

This is the real order `POST /api/analyze` executes in — not a marketing diagram:

```text
Upload (.csv / .xlsx / .json)
        │
        ▼
Parse → Infer schema (type, semantic label, confidence per column)
        │
        ▼
Data quality report (duplicates, invalid values, 0-100 score)
        │
        ▼
Forecast: 7 models backtested on held-out data, lowest RMSE wins
        │
        ▼
Anomalies: univariate (IQR/Z-score) + multivariate (Isolation Forest
           + Local Outlier Factor + One-Class SVM consensus, SHAP-explained)
        │
        ▼
Relationships: Pearson/Spearman correlations, Cramér's V associations,
               ANOVA/Kruskal-Wallis root-cause variance decomposition
        │
        ▼
Ranked findings + insight timeline (evidence-scored, not LLM-picked)
        │
        ▼
Risk alerts (from the forecast trend) → KMeans clustering (auto-K)
        │
        ▼
Great Expectations structural check → Business Health rollup (0-100)
        │
        ▼
Saved to Postgres → LLM narrates the results above, in plain English
```

Every box is a real, separately-testable Python module (see [Project structure](#project-structure)).
The LLM box at the bottom never touches raw data — it only ever narrates
what the boxes above it already computed.

## Design principle: compute first, narrate second

Every number IntelliVerse shows you — a correlation, a forecast, a root-cause
percentage, a risk alert — comes from a real, deterministic computation (pandas,
SciPy, statsmodels, scikit-learn, XGBoost, LightGBM, Prophet, SHAP, NetworkX). The
LLM only ever narrates *already-computed* results in plain English — it never sees
raw data and never invents a statistic. If a computation isn't confident or doesn't
apply, IntelliVerse says so instead of asking the LLM to fill the gap.

## Features

**🔍 Data understanding**
- Figures out what each column *means* on its own — "this is a date," "this
  is revenue" — with a confidence score, no manual mapping (schema + semantic inference)
- Guesses what kind of business the data is from — Retail, Healthcare,
  Finance, Logistics, etc. (domain detection)
- Flags messy data — duplicates, typos, missing values — as one quality score
  you can act on, with each column's label editable if the guess is wrong

**📈 Statistics & analytics**
- Finds which metrics move together, and how strongly — with a real
  significance test behind every claim, not a guess (Pearson/Spearman
  correlation, Cramér's V for categories)
- Explains *why* a number changed — which category or region is actually
  driving it, with a % of the change attributed to each (ANOVA/Kruskal-Wallis
  root-cause breakdown)
- Flags unusual rows — both obvious single-column outliers and subtler ones
  only visible across several columns at once, each with a plain-English
  reason why (Isolation Forest + LOF + One-Class SVM, explained via SHAP)
- Groups similar rows into segments automatically, and surfaces the
  strongest findings first instead of listing everything

**🔮 Forecasting**
- Predicts future values by racing 7 different models against each other and
  keeping whichever is actually most accurate on *this* data — not one
  fixed algorithm every time (naive → Holt's → Random Forest → XGBoost →
  LightGBM → Prophet)
- Tells you upfront which metrics are even worth forecasting, and warns you
  if one is trending toward a critical level (e.g. running out of stock)

**🕸️ Knowledge graph & multi-table**
- Automatically figures out how multiple uploaded tables connect, like
  finding foreign keys without being told what they are
- Turns that into a visual map of your data's relationships (Neo4j-backed,
  with importance scoring via PageRank)
- Simulates how a change to one entity ripples through everything connected
  to it ("digital twin")

**🎛️ Decision support**
- What-if simulator: change one number, see the projected ripple effect on
  every other metric
- An AI-written action plan — but one that can only reason from numbers
  already computed above, never invents a business reason
- Finds the *best combination* of several changes to hit a goal, instead of
  testing one change at a time ("Find the best plan")

**⚡ Real-time streaming & continuous learning**
- Simulates a live data feed and streams new rows through a real message
  broker (Kafka) straight to the dashboard over a WebSocket
- A model updates itself with every new row and is graded on each
  prediction *before* it learns from it — so the accuracy chart you see is
  a genuine, not rigged, measure of it improving over time

**📤 Data access & export**
- Run your own SQL queries directly on the uploaded data, no setup
- Export the whole analysis as a polished PDF report, Excel workbook, or a
  12-slide PowerPoint deck — not just a findings summary
- Watch the analysis happen step-by-step live, instead of a loading spinner

**🔐 Auth & workspace**
- Secure login; every user only ever sees their own data
- Come back later and reopen a past analysis instantly — no re-upload
- Save any result you like (a forecast, a query, a plan) and revisit,
  rename, or delete it anytime

**📄 Knowledge Assistant**
- Upload documents (PDF, Word, PowerPoint, text) and ask questions about
  them — answers come only from what's actually in the file, cited by filename
- Can blend a document's answer with your dataset's own findings in one
  response
- Runs the document-search step entirely on this machine, no external API
  key required (fastembed, chosen specifically because the more common
  PyTorch-based alternative used enough memory to crash the free hosting
  tier the first time anyone tried this feature)

**🎨 Personalization**
- Dark/light mode
- Tell it who you are ("I am a CFO"), and every AI explanation adapts its
  language for that reader — the underlying numbers never change
- A genuine Simple ↔ Expert toggle — Expert mode shows real statistical
  detail (p-values, r², test names), Simple mode never does
- Click any statistics term anywhere in the app to see what it means
- One overall 0-100 health score for the whole dataset, deterministic, no AI involved

## Worked example — a real run, not a mockup

This is the actual output from analyzing the repo's own `backend/sample_business.csv`
against the live deployment (captured directly via the API, included here verbatim):

```text
Domain guessed:        Retail / E-commerce
Business Health:       90/100  (quality 100, growth 68, forecast reliability 100, safety 90)

Top finding:           Category explains 88.9% of the variance in Monetary Amount
                        (ANOVA, p < 0.001) — top segment: Electronics
Second finding:        Geography explains 83.8% of the variance in Monetary Amount
                        (ANOVA, p < 0.001) — top segment: North
Correlation:           Monetary Amount ↔ Profit/Margin, r = 0.998 (strong, significant)

Forecast:              Monetary Amount trending up
                        Model: Holt's linear exponential smoothing
                        (beat naive, linear trend, Random Forest, XGBoost,
                        LightGBM, and Prophet on backtested RMSE)
                        MAPE: 0.01% on the held-out validation period
```

Nothing here is asserted — `variance_explained_pct` and `p_value` come straight
from `scipy.stats.f_oneway` on this exact dataset, and the forecast model was
picked because it had the lowest RMSE among all seven candidates on this
specific series, not because it's the "smart" choice by default.

## Measured, not claimed

Timed directly against the live Render deployment (free tier, shared vCPU —
these numbers reflect that, not the algorithms):

| Operation | Median latency | What it's doing |
|---|---|---|
| `POST /api/analyze` (18-row dataset) | **~23s** | Full pipeline above: 7 forecast models backtested, 3 anomaly detectors, root-cause ANOVA, clustering, GE validation, all in one request |
| `GET /api/datasets` (catalog list) | **~0.9s** | Round trip to Neon Postgres, including its own per-request connect overhead |

Reproduce these yourself: `time curl -X POST .../api/analyze -F file=@sample_business.csv`
against your own deployment — the numbers above aren't cherry-picked, they're the
median of 3 consecutive runs on an already-warm backend.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.12+ |
| Data processing | pandas, NumPy, DuckDB, Polars + PyArrow |
| Statistics/ML | SciPy, statsmodels, scikit-learn, XGBoost, LightGBM, Prophet, SHAP |
| Databases | PostgreSQL (auth + catalog), Neo4j (knowledge graph), Qdrant (documents) |
| Streaming & online learning | Apache Kafka (KRaft, single-node), aiokafka, scikit-learn `SGDRegressor` + `joblib` persistence |
| Document intelligence | fastembed (ONNX embeddings, no PyTorch), pypdf, python-docx, python-pptx |
| Validation | Great Expectations |
| Reports | openpyxl, ReportLab, python-pptx |
| Auth | bcrypt, python-jose (JWT) |
| LLM layer | Any OpenAI-compatible endpoint — [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi) or a local [Ollama](https://ollama.com) both work |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| Visualization | Recharts, @xyflow/react, Three.js + React Three Fiber |
| Observability | Loguru, Prometheus + Grafana (self-hosted) |

## Getting started

### Prerequisites

- 🐍 Python 3.12+
- 🟢 Node 20+
- 🐘 PostgreSQL 17 and 🕸️ Neo4j 5.26 (native install or via [Docker](#docker))
- 🤖 An OpenAI-compatible LLM endpoint — [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi)
  or a local [Ollama](https://ollama.com) install both work; every AI-touching
  feature degrades gracefully (returns `null`/`None` for just that narration,
  never breaks the deterministic result underneath) if this isn't reachable
- 📨 Apache Kafka — only needed for real-time streaming; comes up automatically
  via [Docker](#docker), no native install expected

### Backend

```bash
cd backend
python -m venv venv
./venv/Scripts/activate       # source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # fill in your values
uvicorn main:app --port 8001
```

| Variable | Purpose |
|---|---|
| `FREELLMAPI_BASE_URL`, `FREELLMAPI_API_KEY`, `FREELLMAPI_MODEL` | LLM endpoint for narration (FreeLLMAPI or a local Ollama) |
| `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` | Knowledge graph database |
| `POSTGRES_DSN` | Auth *and* the dataset catalog (datasets, saved items, ask history, model history) |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka broker for real-time streaming (default `localhost:9092`) |
| `KAFKA_SECURITY_PROTOCOL`, `KAFKA_SASL_MECHANISM`, `KAFKA_SASL_USERNAME`, `KAFKA_SASL_PASSWORD`, `KAFKA_SSL_CA_CERT` | Only needed against a hosted Kafka (e.g. Aiven for Apache Kafka, Redpanda Cloud) instead of the unauthenticated local broker — see `.env.example` for the exact values it expects. `KAFKA_SSL_CA_CERT` is only required if the provider signs its server certificate with its own private CA (Aiven does) rather than a publicly-trusted one |
| `JWT_SECRET_KEY` | Signs auth tokens — generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_EXPIRE_MINUTES` | Token lifetime (default 1440 = 24h) |

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**, register an account, and drop in a file (try
`backend/sample_business.csv`).

## Docker

```bash
docker compose up --build
```

One command brings up backend, frontend, Neo4j, Postgres, Kafka, Prometheus, and
Grafana. Verified with a real build — every service starts cleanly and talks to
the others correctly over the compose network.

> ⚠️ If you already have native Postgres/Neo4j/dev servers, or any other
> container, running on the same host ports this stack wants (5432, 7474,
> 7687, 3000, 8001, 9091, 3002), Docker's host-port publishing for those
> services silently no-ops on Windows instead of erroring, or the container
> exits immediately with "port is already allocated." Internal
> container-to-container traffic is unaffected either way — only your own
> browser/curl access from the host is. Stop the conflicting process, or
> remap the host-side port in `docker-compose.yml`, if you want host access
> to the containerized version.

## Observability

- **Structured logging** — Loguru, JSON-lines file (`backend/logs/app.jsonl`) plus
  colorized console output; every request and key event (logins, analysis
  start/failure/completion) is logged.
- **Metrics** — `GET /metrics` exposes Prometheus-format request counts and
  latency. `docker compose up` also starts Prometheus (auto-scraping, on
  **http://localhost:9091**) and Grafana, pre-provisioned with that Prometheus
  datasource — open **http://localhost:3002** (`admin` / `nexuslocal`). Both
  are genuinely wired (Prometheus's scrape target reports `"health":"up"`
  against the real backend, Grafana's datasource is live) — no pre-built
  dashboard panels ship yet, so Grafana opens with the datasource connected
  but an empty dashboard list. Host ports are 9091/3002, not Prometheus/
  Grafana's own defaults of 9090/3001, to avoid colliding with anything else
  already using those ports on your machine.
- Sentry/Langfuse weren't added: both need a separate hosted account, unlike
  Prometheus/Grafana which run entirely inside this stack.

## Deployment

Live at [intelli-verse-phi.vercel.app](https://intelli-verse-phi.vercel.app) —
frontend on **Vercel**, backend on **Render**, all data stores on genuinely
permanent free tiers: **Neon** (Postgres), **Neo4j AuraDB Free** (graph),
**Aiven** (Kafka), **Qdrant Cloud** (vectors). Vercel auto-deploys on push to
`master`; the Render backend auto-deploys too, via a CI step that calls
Render's Deploy Hook after tests pass (`.github/workflows/ci.yml`) — Render's
own GitHub webhook integration stopped firing for this service, so CI
triggers the deploy directly instead of depending on it.

Full step-by-step setup (env vars, why each provider was picked over its
free-but-expiring alternatives, monitoring, and how cold starts are handled)
lives in **[DEPLOYMENT.md](DEPLOYMENT.md)** — kept separate so this README
stays scannable. The auth model, rate limiting, CORS, secrets handling, and
dependency/container scanning are documented in **[SECURITY.md](SECURITY.md)**.

## Testing

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

131 tests across every deterministic module — **81% line coverage** on the 20
modules those tests actually target (`pytest --cov`, tool-measured, not
estimated). LLM-touching modules are tested for their deterministic error
paths only — the LLM calls themselves are verified manually against a live
endpoint.

That 81% is scoped to the modules with dedicated test files on purpose, not
cherry-picked after the fact — it excludes `main.py` (the API/route layer)
and the Postgres/Kafka/Qdrant/Neo4j integration modules, none of which
`pytest` ever imports (see `tests/conftest.py`). Those are verified by
actually running them against the real deployed services instead of a mock,
which catches things a passing mocked test can't — several real production
bugs this project shipped with (a Postgres schema-check running on every
connection, missing Qdrant Cloud payload indexes, rate limiting silently
not enforcing) were found exactly that way, not by unit tests. A single
blanket repo-wide coverage number would bury that distinction, so it's
reported per-scope instead of averaged into one misleading figure.

## Project structure

```
backend/
  main.py                    FastAPI app, all endpoints
  schema_inference.py         Column type/semantic/domain inference
  profiling.py                Data quality scoring
  analytics.py                Anomalies, seasonality, period comparison
  relationships.py            Correlations, associations, root cause
  forecasting.py              Multi-model forecast competition
  anomalies_ml.py             Multivariate anomaly detection (+ SHAP)
  clustering.py                KMeans segmentation
  multi_table.py               Cross-table relationship discovery
  knowledge_graph_builder.py   Neo4j ingestion
  graph_analytics.py           PageRank/centrality via NetworkX
  digital_twin.py              Graph-based impact simulation
  simulation.py                Decision simulation engine
  optimization.py               Multi-lever "find the best plan" search
  autonomous_analyst.py        Autonomous action plan pipeline
  streaming.py                  Kafka producer/consumer for live row streaming
  incremental_model.py          Persistent online-learning model (SGDRegressor)
  duckdb_query.py               Ad-hoc SQL querying
  report.py                     PDF/Excel/PPTX export
  progress_jobs.py              WebSocket progress streaming
  auth.py                       Users, JWT, bcrypt
  catalog.py                    Postgres dataset/document metadata store
  document_intelligence.py      Document chunking, embedding, Qdrant storage/search
  document_qa.py                Retrieval-then-narrate over documents + structured findings
  logging_config.py             Loguru setup
  tests/                        Pytest suite

frontend/
  app/            Next.js App Router pages (/, /login, /workspace, /catalog, /knowledge)
  components/     Dashboard panels, charts, graph explorer
  lib/            API client, auth helpers, types
```

## Contributing

Contributions are welcome — this is an active, evolving project.

1. Fork the repo and create a branch off `master`.
2. Make your change, following the patterns already in the codebase (compute
   deterministically first, let the LLM narrate second — see
   [Design principle](#design-principle-compute-first-narrate-second)).
3. Run the checks before opening a PR:
   ```bash
   cd backend && pytest
   cd frontend && npx tsc --noEmit && npx eslint .
   ```
4. Open a pull request describing what changed and why.

Bug reports and feature requests are just as welcome as code — open an issue.
