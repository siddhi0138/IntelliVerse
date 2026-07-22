# IntelliVerse

**Upload anything. Understand everything.**

IntelliVerse is a universal data analytics platform: drop in a CSV, Excel, or JSON
file and it automatically infers what the columns mean, guesses the
dataset's domain, and generates a full analytical dashboard — schema
inference, statistics, forecasting, anomaly detection, root-cause analysis,
a knowledge graph, decision simulation, and an autonomous action plan. No
configuration, no manual column mapping.

![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Neo4j](https://img.shields.io/badge/Neo4j-018bff?logo=neo4j&logoColor=white)

## Contents

- [Design principle](#design-principle-compute-first-narrate-second)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Docker](#docker)
- [Observability](#observability)
- [Deployment](#deployment)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Known limitations](#known-limitations)

## Design principle: compute first, narrate second

Every number IntelliVerse shows you — a correlation, a forecast, a root-cause
percentage, a risk alert — comes from a real, deterministic computation
(pandas, SciPy, statsmodels, scikit-learn, XGBoost, LightGBM, Prophet,
SHAP, NetworkX). The LLM is only ever handed *already-computed* structured
results and asked to narrate them in plain English. It never sees raw data
and never invents a statistic. If a computation isn't confident or doesn't
apply, IntelliVerse says so explicitly instead of asking the LLM to fill the gap.

## Features

**Data understanding**
- Automatic schema inference (type, semantic meaning, confidence score) and
  domain detection (Retail, Healthcare, Finance, Logistics, etc.)
- Data quality scoring — duplicates, invalid values, missingness — with
  rule-based recommendations
- Editable semantic labels, persisted per column

**Statistics & analytics**
- Pearson/Spearman correlations and Cramér's V associations, each with a
  significance test
- Root-cause variance decomposition (ANOVA/Kruskal-Wallis) per categorical
  dimension
- Distribution analysis (skewness, kurtosis, percentiles, shape
  classification)
- Univariate anomalies (Z-score/IQR) and multivariate anomalies (Isolation
  Forest + Local Outlier Factor + One-Class SVM consensus, explained via
  SHAP)
- KMeans clustering with an automatically chosen K (silhouette score)
- Ranked findings ("Insight Explorer") and a sparse insight timeline

**Forecasting**
- Seven candidate models backtested per target (naive, linear trend, Holt's
  exponential smoothing, Random Forest, XGBoost, LightGBM, Prophet) — the
  one with the lowest validation error is chosen automatically
- Automatic target discovery, forecast comparison table, and
  threshold-crossing risk alerts

**Knowledge graph & multi-table intelligence**
- Multi-file workspace with confidence-scored relationship discovery
  between tables (never assumes a join)
- Neo4j-backed knowledge graph (per-row entities) with PageRank, degree
  centrality, and connected components via NetworkX
- Entity profiles and graph-based "digital twin" impact simulation
  (contribution-share propagation across confirmed relationships)

**Decision support**
- Schema-aware decision simulator (correlation/regression-based
  propagation) with scenario presets and a decision graph
- Autonomous action plan: chains ranked findings, risk alerts, root cause,
  forecast, and a real simulation preview into a prioritized, fully
  grounded plan

**Data access & export**
- Ad-hoc read-only SQL querying over any uploaded dataset (DuckDB)
- Export a completed analysis as PDF, Excel, or PowerPoint
- Live step-by-step progress over WebSocket while an analysis runs
- 2D (@xyflow/react) and 3D (Three.js/React Three Fiber) knowledge graph views

**Auth & workspace**
- Full login wall — Postgres-backed users, bcrypt password hashing, JWT
  bearer tokens on every endpoint
- Per-user dataset catalog — every upload is scoped to your account and
  persists the full analysis result, not just metadata, so reopening a
  past dataset from `/catalog` restores the entire dashboard with no
  re-upload (features needing the live DataFrame — SQL query, on-demand
  forecast/simulation re-runs, the action plan — still need the file
  re-uploaded, since only the computed result is saved)
- Explicitly saved forecasts and simulations, one click each, listed and
  reloadable per dataset

**Knowledge Assistant (document intelligence)**
- Upload PDF/DOCX/PPTX/TXT documents; ask questions across them and get an
  answer grounded only in retrieved excerpts, cited by filename
- Retrieval runs locally: sentence-transformers for embeddings (no
  external API key), Qdrant in on-disk mode (no separate server process)
  — this is the one place in the app Qdrant earns its keep, since every
  other "knowledge base" here is already structured JSON with nothing
  for a vector database to index

## Tech stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.12+ |
| Data processing | pandas, NumPy, DuckDB, Polars + PyArrow (large-file fast path) |
| Statistics/ML | SciPy, statsmodels, scikit-learn, XGBoost, LightGBM, Prophet, SHAP |
| Databases | PostgreSQL 17 (auth), Neo4j 5.26 (knowledge graph), SQLite (metadata catalog), Qdrant (document embeddings, on-disk) |
| Document intelligence | sentence-transformers (local embeddings), pypdf, python-docx, python-pptx |
| Validation | Great Expectations |
| Reports | openpyxl, ReportLab, python-pptx |
| Auth | bcrypt, python-jose (JWT) |
| LLM layer | Any OpenAI-compatible endpoint (defaults to [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi)) — narration only, never raw computation |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| Visualization | Recharts, @xyflow/react (2D graphs), Three.js + React Three Fiber (3D graph view) |
| Observability | Loguru (structured logging), Prometheus + Grafana (self-hosted metrics) |

## Getting started

### Prerequisites

- Python 3.12+
- Node 20+
- PostgreSQL 17 and Neo4j 5.26 (native install or via [Docker](#docker))
- An OpenAI-compatible LLM endpoint (e.g. [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi) running locally)

### Backend

```bash
cd backend
python -m venv venv
./venv/Scripts/activate       # source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # fill in your values — see below
uvicorn main:app --port 8001
```

`.env` variables:

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

Open **http://localhost:3000**, register an account, and drop in a file
(try `backend/sample_business.csv`) — the dashboard renders automatically.

## Docker

```bash
docker compose up --build
```

`docker-compose.yml` wires up the backend, frontend, Neo4j, Postgres,
Prometheus, and Grafana in one command. The containerized Neo4j/Postgres
get fresh local credentials (overridden in the `backend` service's
`environment:` block) rather than needing your native install's
credentials; `FREELLMAPI_BASE_URL` is overridden to `host.docker.internal`
since the LLM router typically runs natively on the host, outside the
compose network.

> **Verified with a real `docker compose up --build`.** Caught one real
> bug in the process: `xgboost==3.3.0` requires Python ≥3.12, but
> `backend/Dockerfile` was on `python:3.11-slim` — fixed to `3.13-slim`
> (matching the exact version the local dev venv already runs). After
> that, every service builds and starts cleanly: registration/login
> (Postgres), a full analyze call, and a multi-table workspace + Neo4j
> knowledge graph build all verified working over the compose network,
> plus Prometheus successfully scraping the backend and Grafana's health
> check passing.
>
> **If you already have native Postgres/Neo4j/dev servers running on the
> same ports** (5432, 7474, 7687, 3000, 8001), Docker's host-port
> publishing for those services silently no-ops on Windows instead of
> erroring — `docker compose ps` will show the containers as "Up" but
> `docker port <container>` returns nothing for the conflicting port.
> Internal container-to-container traffic (backend ↔ Postgres ↔ Neo4j,
> Prometheus ↔ backend) is unaffected either way since it doesn't use the
> host-published ports at all — only *your own* browser/curl access to
> those services from the host is affected. Stop the conflicting native
> processes first if you want host access to the containerized versions.

## Observability

- **Structured logging** (`backend/logging_config.py`) — Loguru, with
  stdlib `logging` (uvicorn, cmdstanpy) routed through the same sink so
  everything lands in one place: colorized console output plus a rotating
  JSON-lines file (`backend/logs/app.jsonl`) for later machine parsing. A
  request-logging middleware records method/path/status/duration on every
  call; registration/login attempts and analysis start/failure/completion
  are logged explicitly.
- **Metrics** — `GET /metrics` (via `prometheus-fastapi-instrumentator`)
  exposes request counts and latency histograms in Prometheus format, no
  external account needed. `docker compose up` also starts a `prometheus`
  service (scraping the backend automatically) and a `grafana` service
  pre-provisioned with that Prometheus instance as its datasource — open
  **http://localhost:3001** (default login `admin` / `nexuslocal`) and it's
  ready to build dashboards against, no manual datasource setup required.
- Sentry/Langfuse weren't added: both are hosted SaaS requiring your own
  account and API key, unlike Prometheus/Grafana which run entirely in
  this compose stack.

## Deployment

The backend (FastAPI, in-memory caches, WebSockets, Neo4j/Postgres
connections, heavy ML dependencies) doesn't fit a serverless platform —
each function invocation could land on a different stateless instance,
breaking every multi-step flow (analyze → simulate → forecast → query →
report all depend on the cached DataFrame surviving between calls).
Frontend and backend are deployed separately, to platforms suited to each:

**Frontend → Vercel**
1. Import this repo in Vercel, set the project root to `frontend/`.
2. Set `NEXT_PUBLIC_API_BASE` to your deployed backend's URL.
3. Vercel auto-detects Next.js — no further config needed (the
   `output: "standalone"` setting in `next.config.ts` is for the Docker
   build; Vercel uses its own build pipeline regardless).

**Backend → Railway (or Render/Fly.io)**
1. Create a service from this repo, root directory `backend/` — Railway
   detects `Dockerfile` automatically and builds/deploys it directly.
2. Add Postgres from Railway's built-in template.
3. Add Neo4j as a service from the `neo4j:5.26-community` Docker image
   (Railway supports deploying arbitrary images, not just repos).
4. Set the same environment variables as `backend/.env.example`, pointing
   `NEO4J_URI`/`POSTGRES_DSN` at Railway's internal service hostnames
   instead of `localhost`.
5. Update the frontend's CORS origin in `main.py` (`allow_origins`,
   currently hardcoded to `http://localhost:3000`) to your Vercel domain.

This hasn't been executed — it needs your own Vercel/Railway accounts —
but the Dockerfiles it depends on are the same ones verified in
[Docker](#docker) above.

## Testing

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

47 tests across every deterministic module (schema inference, analytics,
forecasting, relationships, clustering, the digital-twin simulation, etc.).
LLM-touching modules are tested for their deterministic error paths only —
the LLM calls themselves are verified manually against a live endpoint.

## Project structure

```
backend/
  main.py                 FastAPI app, all endpoints
  schema_inference.py      Column type/semantic/domain inference
  profiling.py             Data quality scoring
  analytics.py             Anomalies, seasonality, period comparison
  relationships.py         Correlations, associations, root cause
  forecasting.py           Multi-model forecast competition
  anomalies_ml.py          Multivariate anomaly detection (+ SHAP)
  clustering.py            KMeans segmentation
  multi_table.py           Cross-table relationship discovery
  knowledge_graph_builder.py  Neo4j ingestion
  graph_analytics.py       PageRank/centrality via NetworkX
  digital_twin.py          Graph-based impact simulation
  simulation.py            Decision simulation engine
  autonomous_analyst.py    Autonomous action plan pipeline
  duckdb_query.py          Ad-hoc SQL querying
  report.py                PDF/Excel/PPTX export
  progress_jobs.py         WebSocket progress streaming
  auth.py                  Users, JWT, bcrypt
  catalog.py               SQLite dataset/document metadata store
  document_intelligence.py Document chunking, embedding, Qdrant storage/search
  document_qa.py           Retrieval-then-narrate over documents + structured findings
  logging_config.py        Loguru setup, stdlib logging interception
  tests/                   Pytest suite

frontend/
  app/                     Next.js App Router pages (/, /login, /workspace, /catalog, /knowledge)
  components/              Dashboard panels, charts, graph explorer
  lib/                     API client, auth helpers, types
```

## Known limitations

Deliberately unbuilt, stated plainly rather than silently dropped:

- Kendall correlation, DBSCAN, community detection beyond connected
  components, a relationship timeline
- Text-to-Cypher / natural-language graph queries
- A full temporal event engine (beyond the graph-based impact propagation
  in the digital twin)
- **LangGraph**: the Knowledge Assistant's retrieval pipeline
  (`document_qa.py`) and every other multi-step LLM pipeline in this
  backend (`qa.py`, `autonomous_analyst.py`) are plain async functions
  chaining a fixed sequence of steps — retrieve/compute, then one LLM
  call narrates. None of them have the dynamic branching or multi-agent
  handoff that would make LangGraph's orchestration model earn its
  complexity over a function call; adopting it now would be the same
  "framework for its own sake" pattern already declined once for the
  same reason.
- Real deployment (Vercel/Railway) — documented under
  [Deployment](#deployment), not executed, since it needs your own
  cloud accounts
- Hosted observability (Sentry/Langfuse) — the self-hosted
  Prometheus+Grafana stack already covers metrics/logging without
  needing a third-party account; only worth adding on top if you
  specifically want SaaS crash reporting or LLM-call tracing
