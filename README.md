<div align="center">

# 🧠 IntelliVerse

**Upload anything. Understand everything.**

IntelliVerse is a universal data analytics platform: drop in a CSV, Excel, or JSON
file and it automatically infers what the columns mean, guesses the dataset's
domain, and generates a full analytical dashboard — schema inference, statistics,
forecasting, anomaly detection, root-cause analysis, a knowledge graph, decision
simulation, and an autonomous action plan. No configuration, no manual column
mapping.

![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Neo4j](https://img.shields.io/badge/Neo4j-018bff?logo=neo4j&logoColor=white)

</div>

## 📚 Contents

- [🎯 Design principle](#design-principle-compute-first-narrate-second)
- [✨ Features](#features)
- [🛠️ Tech stack](#tech-stack)
- [🚀 Getting started](#getting-started)
- [🐳 Docker](#docker)
- [📊 Observability](#observability)
- [☁️ Deployment](#deployment)
- [🧪 Testing](#testing)
- [📁 Project structure](#project-structure)
- [🤝 Contributing](#contributing)

## Design principle: compute first, narrate second

Every number IntelliVerse shows you — a correlation, a forecast, a root-cause
percentage, a risk alert — comes from a real, deterministic computation (pandas,
SciPy, statsmodels, scikit-learn, XGBoost, LightGBM, Prophet, SHAP, NetworkX). The
LLM only ever narrates *already-computed* results in plain English — it never sees
raw data and never invents a statistic. If a computation isn't confident or doesn't
apply, IntelliVerse says so instead of asking the LLM to fill the gap.

## Features

**🔍 Data understanding**
- Automatic schema inference (type, semantic meaning, confidence score) and
  domain detection (Retail, Healthcare, Finance, Logistics, etc.)
- Data quality scoring with rule-based recommendations
- Editable semantic labels, persisted per column

**📈 Statistics & analytics**
- Pearson/Spearman correlations and Cramér's V associations, each significance-tested
- Root-cause variance decomposition (ANOVA/Kruskal-Wallis) per dimension
- Distribution analysis (skewness, kurtosis, percentiles, shape classification)
- Univariate anomalies (Z-score/IQR) and multivariate anomalies (Isolation Forest +
  Local Outlier Factor + One-Class SVM consensus, explained via SHAP)
- KMeans clustering with an automatically chosen K (silhouette score)
- Ranked findings ("Insight Explorer") and a sparse insight timeline

**🔮 Forecasting**
- Seven candidate models backtested per target (naive, linear trend, Holt's
  exponential smoothing, Random Forest, XGBoost, LightGBM, Prophet) — lowest
  validation error wins, automatically
- Automatic target discovery, forecast comparison table, threshold-crossing risk alerts

**🕸️ Knowledge graph & multi-table intelligence**
- Multi-file workspace with confidence-scored relationship discovery between tables
- Neo4j-backed knowledge graph with PageRank, degree centrality, connected components
- Entity profiles and graph-based "digital twin" impact simulation

**🎛️ Decision support**
- Schema-aware decision simulator with scenario presets and a decision graph
- Autonomous action plan chaining findings, risk alerts, root cause, forecast, and
  a real simulation preview into a prioritized, grounded plan
- Multi-lever optimizer ("Find the best plan") — searches combinations of
  levers at once for the one that best moves a chosen goal metric, not just
  one change at a time; survives a refresh (the last run and any explicitly
  saved plans both persist server-side)

**⚡ Real-time streaming & continuous learning**
- A genuine Kafka broker (single-node KRaft, official Apache image) carries
  new rows for a dataset from a producer to a consumer over the real wire
  protocol — "Go live" starts a background producer that samples new rows
  from the dataset's own distribution (there's no external live feed to plug
  into locally, so this part is simulated), which is then genuinely queued,
  consumed, and pushed to the UI over a WebSocket
- Each new row also updates a persistent online-learning model
  (`SGDRegressor` + `StandardScaler`, `partial_fit`, not retrained from
  scratch) for the dataset's primary metric — every update first scores the
  model's prediction against the actual value (a real out-of-sample check)
  *before* learning from it, and the resulting accuracy history is charted
  so you can see the model genuinely improving over time
- Both survive a page refresh: the frontend re-checks stream/model status on
  mount instead of assuming a blank slate

**📤 Data access & export**
- Ad-hoc read-only SQL querying over any uploaded dataset (DuckDB)
- Export a completed analysis as a multi-page PDF, a multi-sheet Excel
  workbook, or a 12-slide PowerPoint deck — business health, data quality
  detail, key findings, root cause, relationships, segmentation, risk
  alerts, forecast (with a real chart), anomalies, and a full data
  dictionary, not just a findings summary
- Live step-by-step progress over WebSocket while an analysis runs
- 2D (@xyflow/react) and 3D (Three.js/React Three Fiber) knowledge graph views

**🔐 Auth & workspace**
- Full login wall — Postgres-backed users, bcrypt hashing, JWT on every endpoint
- Per-user dataset catalog — reopening a past dataset restores the entire
  dashboard, no re-upload needed
- Explicitly saved forecasts, simulations, action plans, optimizer plans, and
  SQL queries, each tagged with the persona active when it was saved (so two
  saves under different personas stay distinguishable later), reloadable or
  deletable per dataset — same full save/list/delete pattern everywhere it
  applies, including clearing or deleting individual entries from the Ask
  IntelliVerse conversation history

**📄 Knowledge Assistant (document intelligence)**
- Upload PDF/DOCX/PPTX/TXT documents and ask questions across them — answers
  grounded only in retrieved excerpts, cited by filename
- Optionally combine document retrieval with a dataset's own ranked findings
  in the same answer — genuinely grounded in both, not just documents alone
- Runs fully locally: sentence-transformers for embeddings, Qdrant for storage —
  no external API key required

**🎨 Personalization**
- Manual light/dark mode toggle (top bar) — persisted per browser, applied
  before first paint so there's no flash of the wrong theme on reload
- Persona field ("I am a...", any free-text role) reframes every AI narration
  — findings, forecast explanations, action plan — for that reader, without
  ever changing the underlying numbers
- Simple/Expert mode is a genuine language difference, not a collapse toggle —
  Simple stays plain-English throughout; Expert rewrites the same findings with
  technical vocabulary and full precision inline (test names, p-values, r/effect
  sizes), and the AI narration is instructed to match the same register. The
  "hover for the numbers" affordance itself behaves identically in both modes
- Every statistical term (p-value, r, Cramér's V, ANOVA, MAPE, silhouette score,
  SHAP, IQR/Z-score, ...) is a clickable glossary link, in both modes, everywhere
  it appears — Relationships, Root Cause, Insight Explorer, Forecast, Clustering,
  Anomalies, Decision Simulator
- Business Health Score — one deterministic 0–100 rollup of data quality,
  growth, forecast reliability, and risk, no LLM involved

## Tech stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.12+ |
| Data processing | pandas, NumPy, DuckDB, Polars + PyArrow |
| Statistics/ML | SciPy, statsmodels, scikit-learn, XGBoost, LightGBM, Prophet, SHAP |
| Databases | PostgreSQL (auth), Neo4j (knowledge graph), SQLite (catalog), Qdrant (documents) |
| Streaming & online learning | Apache Kafka (KRaft, single-node), aiokafka, scikit-learn `SGDRegressor` + `joblib` persistence |
| Document intelligence | sentence-transformers, pypdf, python-docx, python-pptx |
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
| `POSTGRES_DSN` | Auth database |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka broker for real-time streaming (default `localhost:9092`) |
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

The backend (in-memory caches, WebSockets, Neo4j/Postgres connections, heavy ML
deps) doesn't fit a serverless platform, so frontend and backend deploy
separately:

### Frontend → Vercel
1. Import this repo, set the project root to `frontend/`.
2. Set `NEXT_PUBLIC_API_BASE` to your deployed backend's URL — **before your
   first build**, or before any build you want it to take effect in. Next.js
   bakes `NEXT_PUBLIC_*` variables into the client-side JS at *build* time,
   not at request time — setting it in Vercel's dashboard after the fact
   does nothing until you trigger a new deploy. Skip this and every visitor's
   browser tries to call `http://localhost:8001` (the dev fallback) instead
   of your real backend — every request fails, with no obvious error beyond
   "can't reach localhost." If this happens, the app itself now logs a clear
   console error naming the problem, but only after you've deployed with it
   missing at least once — so it's worth double-checking this variable
   *before* your first production build, not after debugging a broken deploy.
3. Vercel auto-detects Next.js — no further config needed.

### Backend → Render
1. Create a **Web Service** from this repo, root directory `backend/` — Render
   detects `Dockerfile` and builds/deploys it directly.
2. Create a **Render Postgres** instance and copy its Internal Database URL.
3. Create a second Render service for Neo4j from the `neo4j:5.26-community`
   Docker image, with a persistent disk mounted for `/data`.
4. Add the environment variables below to the backend Web Service.
5. Real-time streaming (Kafka) is **not** part of this Render setup — Kafka
   only runs inside the local `docker-compose` stack, and Render hosts just
   the one backend web service, no broker alongside it. The backend retries
   connecting (with capped exponential backoff, not a fixed 5s hammer) and
   logs a warning periodically, but the "Go live" feature genuinely won't
   work on a Render-only deployment. To make it work there too, provision a
   separate hosted Kafka (e.g. Upstash Kafka's free tier speaks the same
   protocol) and set `KAFKA_BOOTSTRAP_SERVERS` to it — otherwise this is an
   expected gap, not a bug, and every other feature is unaffected.

**Environment variables to add on Render:**

| Variable | Value |
|---|---|
| `FRONTEND_ORIGINS` | Your Vercel domain, e.g. `https://your-app.vercel.app` (comma-separate if you have more than one) |
| `FREELLMAPI_BASE_URL` | Your LLM endpoint's base URL |
| `FREELLMAPI_API_KEY` | Your LLM endpoint's API key |
| `FREELLMAPI_MODEL` | `auto` (or a specific model name) |
| `NEO4J_URI` | `bolt://<your-neo4j-service>.onrender.com:7687` |
| `NEO4J_USER` | `neo4j` |
| `NEO4J_PASSWORD` | A password you set on the Neo4j service |
| `POSTGRES_DSN` | The Internal Database URL from your Render Postgres instance |
| `JWT_SECRET_KEY` | Generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_EXPIRE_MINUTES` | `1440` |

Live at [intelli-verse-phi.vercel.app](https://intelli-verse-phi.vercel.app) — the
Vercel project is git-connected (auto-deploys on push to `master`); the Render
backend redeploys manually. To run your own copy, follow the steps above with
your own Vercel/Render accounts.

## Testing

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

52 tests across every deterministic module. LLM-touching modules are tested for
their deterministic error paths only — the LLM calls themselves are verified
manually against a live endpoint.

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
  catalog.py                    SQLite dataset/document metadata store
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
