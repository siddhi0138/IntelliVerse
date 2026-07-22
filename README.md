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

**📤 Data access & export**
- Ad-hoc read-only SQL querying over any uploaded dataset (DuckDB)
- Export a completed analysis as PDF, Excel, or PowerPoint
- Live step-by-step progress over WebSocket while an analysis runs
- 2D (@xyflow/react) and 3D (Three.js/React Three Fiber) knowledge graph views

**🔐 Auth & workspace**
- Full login wall — Postgres-backed users, bcrypt hashing, JWT on every endpoint
- Per-user dataset catalog — reopening a past dataset restores the entire
  dashboard, no re-upload needed
- Explicitly saved forecasts and simulations, reloadable per dataset

**📄 Knowledge Assistant (document intelligence)**
- Upload PDF/DOCX/PPTX/TXT documents and ask questions across them — answers
  grounded only in retrieved excerpts, cited by filename
- Runs fully locally: sentence-transformers for embeddings, Qdrant for storage —
  no external API key required

## Tech stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.12+ |
| Data processing | pandas, NumPy, DuckDB, Polars + PyArrow |
| Statistics/ML | SciPy, statsmodels, scikit-learn, XGBoost, LightGBM, Prophet, SHAP |
| Databases | PostgreSQL (auth), Neo4j (knowledge graph), SQLite (catalog), Qdrant (documents) |
| Document intelligence | sentence-transformers, pypdf, python-docx, python-pptx |
| Validation | Great Expectations |
| Reports | openpyxl, ReportLab, python-pptx |
| Auth | bcrypt, python-jose (JWT) |
| LLM layer | Any OpenAI-compatible endpoint (defaults to [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi)) |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| Visualization | Recharts, @xyflow/react, Three.js + React Three Fiber |
| Observability | Loguru, Prometheus + Grafana (self-hosted) |

## Getting started

### Prerequisites

- 🐍 Python 3.12+
- 🟢 Node 20+
- 🐘 PostgreSQL 17 and 🕸️ Neo4j 5.26 (native install or via [Docker](#docker))
- 🤖 An OpenAI-compatible LLM endpoint (e.g. [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi))

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
| `FREELLMAPI_BASE_URL`, `FREELLMAPI_API_KEY`, `FREELLMAPI_MODEL` | LLM endpoint for narration |
| `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` | Knowledge graph database |
| `POSTGRES_DSN` | Auth database |
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

One command brings up backend, frontend, Neo4j, Postgres, Prometheus, and
Grafana. Verified with a real build — every service starts cleanly and talks to
the others correctly over the compose network.

> ⚠️ If you already have native Postgres/Neo4j/dev servers running on the same
> ports (5432, 7474, 7687, 3000, 8001), Docker's host-port publishing for those
> services silently no-ops on Windows instead of erroring. Internal
> container-to-container traffic is unaffected either way — only your own
> browser/curl access from the host is. Stop the conflicting native processes
> first if you want host access to the containerized versions.

## Observability

- **Structured logging** — Loguru, JSON-lines file (`backend/logs/app.jsonl`) plus
  colorized console output; every request and key event (logins, analysis
  start/failure/completion) is logged.
- **Metrics** — `GET /metrics` exposes Prometheus-format request counts and
  latency. `docker compose up` also starts Prometheus (auto-scraping) and
  Grafana, pre-provisioned with that datasource — open **http://localhost:3001**
  (`admin` / `nexuslocal`).
- Sentry/Langfuse weren't added: both need a separate hosted account, unlike
  Prometheus/Grafana which run entirely inside this stack.

## Deployment

The backend (in-memory caches, WebSockets, Neo4j/Postgres connections, heavy ML
deps) doesn't fit a serverless platform, so frontend and backend deploy
separately:

### Frontend → Vercel
1. Import this repo, set the project root to `frontend/`.
2. Set `NEXT_PUBLIC_API_BASE` to your deployed backend's URL.
3. Vercel auto-detects Next.js — no further config needed.

### Backend → Render
1. Create a **Web Service** from this repo, root directory `backend/` — Render
   detects `Dockerfile` and builds/deploys it directly.
2. Create a **Render Postgres** instance and copy its Internal Database URL.
3. Create a second Render service for Neo4j from the `neo4j:5.26-community`
   Docker image, with a persistent disk mounted for `/data`.
4. Add the environment variables below to the backend Web Service.
5. Update `allow_origins` in `backend/main.py` (currently
   `http://localhost:3000`) to your Vercel domain.

**Environment variables to add on Render:**

| Variable | Value |
|---|---|
| `FREELLMAPI_BASE_URL` | Your LLM endpoint's base URL |
| `FREELLMAPI_API_KEY` | Your LLM endpoint's API key |
| `FREELLMAPI_MODEL` | `auto` (or a specific model name) |
| `NEO4J_URI` | `bolt://<your-neo4j-service>.onrender.com:7687` |
| `NEO4J_USER` | `neo4j` |
| `NEO4J_PASSWORD` | A password you set on the Neo4j service |
| `POSTGRES_DSN` | The Internal Database URL from your Render Postgres instance |
| `JWT_SECRET_KEY` | Generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_EXPIRE_MINUTES` | `1440` |

Not yet executed — it needs your own Vercel/Render accounts — but the
Dockerfiles it relies on are the same ones verified under [Docker](#docker).

## Testing

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

47 tests across every deterministic module. LLM-touching modules are tested for
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
  autonomous_analyst.py        Autonomous action plan pipeline
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
