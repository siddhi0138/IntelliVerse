# NEXUS

**Upload anything. Understand everything.**

NEXUS is a universal data analytics platform: drop in a CSV, Excel, or JSON
file and it automatically infers what the columns mean, guesses the
dataset's domain, and generates a full analytical dashboard — schema
inference, statistics, forecasting, anomaly detection, root-cause analysis,
a knowledge graph, decision simulation, and an autonomous action plan. No
configuration, no manual column mapping.

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
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
- [Testing](#testing)
- [Project structure](#project-structure)
- [Known limitations](#known-limitations)

## Design principle: compute first, narrate second

Every number NEXUS shows you — a correlation, a forecast, a root-cause
percentage, a risk alert — comes from a real, deterministic computation
(pandas, SciPy, statsmodels, scikit-learn, XGBoost, LightGBM, Prophet,
SHAP, NetworkX). The LLM is only ever handed *already-computed* structured
results and asked to narrate them in plain English. It never sees raw data
and never invents a statistic. If a computation isn't confident or doesn't
apply, NEXUS says so explicitly instead of asking the LLM to fill the gap.

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

**Auth**
- Full login wall — Postgres-backed users, bcrypt password hashing, JWT
  bearer tokens on every endpoint

## Tech stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.11+ |
| Data processing | pandas, NumPy, DuckDB, Polars + PyArrow (large-file fast path) |
| Statistics/ML | SciPy, statsmodels, scikit-learn, XGBoost, LightGBM, Prophet, SHAP |
| Databases | PostgreSQL 17 (auth), Neo4j 5.26 (knowledge graph), SQLite (metadata catalog) |
| Validation | Great Expectations |
| Reports | openpyxl, ReportLab, python-pptx |
| Auth | bcrypt, python-jose (JWT) |
| LLM layer | Any OpenAI-compatible endpoint (defaults to [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi)) — narration only, never raw computation |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| Visualization | Recharts, @xyflow/react (graphs) |

## Getting started

### Prerequisites

- Python 3.11+
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

`docker-compose.yml` wires up the backend, frontend, Neo4j, and Postgres in
one command. The containerized Neo4j/Postgres get fresh local credentials
(overridden in the `backend` service's `environment:` block) rather than
needing your native install's credentials; `FREELLMAPI_BASE_URL` is
overridden to `host.docker.internal` since the LLM router typically runs
natively on the host, outside the compose network.

> **Note:** this hasn't been verified with a real `docker compose up` on
> this machine (Docker isn't installed here) — the Dockerfiles are written
> from known packaging requirements for this dependency set. The most
> likely first failure point is Prophet or SHAP needing a source compile if
> no prebuilt wheel matches `python:3.11-slim`.

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
  catalog.py               SQLite dataset metadata store
  tests/                   Pytest suite

frontend/
  app/                     Next.js App Router pages (/, /login, /workspace, /catalog)
  components/              Dashboard panels, charts, graph explorer
  lib/                     API client, auth helpers, types
```

## Known limitations

Deliberately unbuilt, stated plainly rather than silently dropped:

- Kendall correlation, DBSCAN, community detection beyond connected
  components, a relationship timeline
- Text-to-Cypher / natural-language graph queries
- Three.js/React Three Fiber visualization, a full temporal event engine
- Qdrant/LlamaIndex/GraphRAG (there's no unstructured document corpus in
  this app to justify a vector database)
- Hosted deployment, CI/CD, and observability (Sentry/Langfuse/
  Prometheus+Grafana) — meaningful only once something is actually deployed
  somewhere
- Docker Compose is written but not yet verified with a real build (see
  [Docker](#docker) above)
