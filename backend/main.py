import asyncio
import io
import re
import time
import uuid
from dataclasses import asdict
from typing import Callable

from dotenv import load_dotenv

load_dotenv()  # must run before `insights` reads FREELLMAPI_* env vars at import time

from logging_config import configure_logging

configure_logging()

import networkx as nx
import pandas as pd
import polars as pl
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from loguru import logger
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel

from analytics import detect_anomalies, detect_seasonality, detect_time_series_spikes, period_over_period
from anomalies_ml import detect_multivariate_anomalies
from auth import AuthError, authenticate_user, create_access_token, create_user, decode_access_token
import catalog
from clustering import cluster_rows
from distributions import analyze_distributions
from forecasting import check_forecast_eligibility, discover_forecastable_targets, select_and_forecast
from ge_validation import run_validation as run_ge_validation
from graph_analytics import compute_graph_analytics
from graph_builder import build_knowledge_graph
from insight_ranking import build_ranked_findings
from insight_timeline import build_insight_timeline
from insights import (
    InsightsUnavailable,
    generate_dataset_summary,
    generate_forecast_explanation,
    generate_insights,
    generate_simulation_explanation,
)
from autonomous_analyst import generate_action_plan
from digital_twin import simulate_entity_impact
from duckdb_query import UnsafeQueryError, run_query
from knowledge_graph_builder import build_graph
from multi_table import RelationshipCandidate, discover_relationships
from neo4j_client import get_driver
from profiling import build_quality_report
from progress_jobs import create_job, get_job
from qa import answer_question
from relationships import categorical_associations, numeric_correlations, root_cause_breakdown
from report import build_excel_report, build_pdf_report, build_pptx_report
from risk_alerts import generate_risk_alerts
from schema_inference import ColumnSchema, build_schema, guess_domain, monthly_series, suggest_charts
from simulation import CorrelationRegressionEngine, build_decision_actions

app = FastAPI(title="IntelliVerse API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exposes GET /metrics in Prometheus text format (request counts, latency
# histograms, in-progress requests) — self-hosted, no external account,
# scraped by the prometheus service in docker-compose.yml.
Instrumentator().instrument(app).expose(app, include_in_schema=False)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "{method} {path} -> {status} ({duration_ms:.1f}ms)",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration_ms=duration_ms,
    )
    return response


def get_current_user(
    authorization: str | None = Header(default=None),
    token: str | None = Query(default=None),
) -> str:
    # `token` query param exists for the one endpoint a plain <a href>
    # download link hits (/report) — browsers can't attach a custom header
    # to a navigation-triggered download, same reasoning as the WS handshake.
    bearer = None
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization.split(" ", 1)[1]
    elif token:
        bearer = token
    if not bearer:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")
    try:
        return decode_access_token(bearer)
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


# Every data-bearing endpoint requires a valid JWT; only /api/health and
# /api/auth/* stay on the bare `app` router, unauthenticated.
protected = APIRouter(dependencies=[Depends(get_current_user)])

# In-memory, single-process cache so /api/simulate can re-use the parsed
# DataFrame without re-uploading the file. Fine for a local single-user dev
# tool; lost on restart, unbounded growth is not a concern at this scale.
_ANALYSIS_DF_CACHE: dict[str, pd.DataFrame] = {}
_ANALYSIS_SCHEMA_CACHE: dict[str, list[ColumnSchema]] = {}
# Full /api/analyze response, kept so /report can format already-computed
# results instead of re-running analysis.
_ANALYSIS_RESULT_CACHE: dict[str, dict] = {}

# V5: multi-table workspaces (distinct from the single-table analysis cache
# above). Tables/schemas are the source of truth for re-running relationship
# discovery or rebuilding the graph; the NetworkX graph is cached after
# confirmation so /graph and /entity endpoints don't hit Neo4j on every call.
_WORKSPACE_TABLES_CACHE: dict[str, dict[str, pd.DataFrame]] = {}
_WORKSPACE_SCHEMAS_CACHE: dict[str, dict[str, list[ColumnSchema]]] = {}
_WORKSPACE_GRAPH_CACHE: dict[str, nx.MultiDiGraph] = {}

_simulation_engine = CorrelationRegressionEngine()


# Measured directly (not assumed): pandas' own C parser and Polars are
# indistinguishable up to ~6MB/300k rows: the crossover where Polars'
# multithreaded Rust parser is actually faster only shows up at genuinely
# large files (~25% faster at 95MB/3M rows in testing). Below this
# threshold the extra code path isn't worth it; used only for the initial
# read either way — every downstream module still works on the resulting
# pandas DataFrame unchanged.
_POLARS_FAST_PATH_THRESHOLD_BYTES = 20_000_000


def _read_dataframe(filename: str, content: bytes) -> pd.DataFrame:
    lowered = filename.lower()
    buffer = io.BytesIO(content)
    if lowered.endswith(".csv"):
        if len(content) > _POLARS_FAST_PATH_THRESHOLD_BYTES:
            return pl.read_csv(io.BytesIO(content)).to_pandas()
        return pd.read_csv(buffer)
    if lowered.endswith((".xlsx", ".xls")):
        return pd.read_excel(buffer)
    if lowered.endswith(".json"):
        return pd.read_json(buffer)
    raise HTTPException(status_code=400, detail="Unsupported file type. Upload a .csv, .xlsx, or .json file.")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


class AuthRequest(BaseModel):
    username: str
    password: str


@app.post("/api/auth/register")
def register(req: AuthRequest) -> dict:
    if len(req.username.strip()) < 3 or len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Username must be 3+ chars, password 8+ chars.")
    try:
        create_user(req.username.strip(), req.password)
    except AuthError as exc:
        logger.warning("Registration failed for username={username}: {reason}", username=req.username.strip(), reason=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    logger.info("New user registered: username={username}", username=req.username.strip())
    return {"access_token": create_access_token(req.username.strip()), "token_type": "bearer"}


@app.post("/api/auth/login")
def login(req: AuthRequest) -> dict:
    if not authenticate_user(req.username.strip(), req.password):
        logger.warning("Failed login attempt for username={username}", username=req.username.strip())
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    logger.info("User logged in: username={username}", username=req.username.strip())
    return {"access_token": create_access_token(req.username.strip()), "token_type": "bearer"}


def _run_analysis(
    filename: str, content: bytes, username: str, progress: Callable[[str], None] = lambda step: None
) -> dict:
    logger.info("Analysis started: filename={filename} size_bytes={size}", filename=filename, size=len(content))
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    progress("Parsing file")
    try:
        df = _read_dataframe(filename, content)
    except HTTPException:
        raise
    except Exception as exc:  # pandas parse errors, bad encoding, etc.
        logger.error("Analysis failed to parse file={filename}: {error}", filename=filename, error=str(exc))
        raise HTTPException(status_code=400, detail=f"Could not parse file: {exc}") from exc

    if df.empty:
        raise HTTPException(status_code=400, detail="Uploaded file has no rows.")

    progress("Inferring schema")
    schema = build_schema(df)
    charts = suggest_charts(df, schema)
    domain = guess_domain(list(df.columns))
    graph = build_knowledge_graph(schema, domain)

    date_cols = [c for c in schema if c.type == "date"]
    numeric_cols = [c for c in schema if c.type == "numeric"]
    id_cols = [c for c in schema if c.type == "id"]
    primary_metric = numeric_cols[0].name if numeric_cols else None

    # v1 backfill: data quality profiling (duplicates, invalid values, score, recommendations)
    progress("Checking data quality")
    quality = build_quality_report(df, schema)

    # v3: forecast eligibility is always reported, even when there's no date
    # column at all, so the frontend can explain *why* instead of just
    # showing nothing.
    forecast_eligibility = check_forecast_eligibility(
        has_date_column=bool(date_cols),
        has_numeric_column=bool(numeric_cols),
        series_length=0,
    )

    forecast = None
    monthly = []
    forecastable_targets = []
    if date_cols and numeric_cols:
        progress("Backtesting forecast models")
        monthly = monthly_series(df, date_cols[0].name, numeric_cols[0].name)
        forecast_eligibility = check_forecast_eligibility(True, True, len(monthly))
        if forecast_eligibility["eligible"]:
            forecast = select_and_forecast(monthly)
            forecast["column"] = numeric_cols[0].semantic_label
        forecastable_targets = discover_forecastable_targets(df, schema, date_cols[0].name, monthly_series)

    progress("Detecting anomalies")
    anomalies = detect_anomalies(df, schema, id_column=id_cols[0].name if id_cols else None)
    multivariate_anomalies = detect_multivariate_anomalies(df, schema, id_column=id_cols[0].name if id_cols else None)
    time_series_spikes = detect_time_series_spikes(monthly) if monthly else []
    seasonality = detect_seasonality(monthly) if monthly else {"detected": False, "reason": "no_time_series"}
    period_comparison = period_over_period(monthly) if monthly else None

    # v2 backfill: relationship discovery + root cause
    progress("Analyzing relationships and root cause")
    correlations = numeric_correlations(df, schema)
    associations = categorical_associations(df, schema)
    root_cause = root_cause_breakdown(df, schema, primary_metric) if primary_metric else None
    distributions = analyze_distributions(df, schema)

    # v2: unified ranked findings + insight timeline, both grounded in the
    # deterministic computations above rather than LLM-scored prose
    ranked_findings = build_ranked_findings(correlations, associations, root_cause, anomalies)
    insight_timeline = build_insight_timeline(monthly, time_series_spikes) if monthly else []

    # v3: deterministic risk alerts from the forecast + root cause
    risk_alerts = generate_risk_alerts(
        forecast, root_cause, numeric_cols[0].semantic_label if numeric_cols else None
    )

    # additive ML: KMeans segmentation (K chosen via silhouette score, not assumed)
    progress("Clustering")
    clustering = cluster_rows(df, schema, id_column=id_cols[0].name if id_cols else None)

    # additive: Great Expectations as a supplementary structural sanity check,
    # layered on top of (not replacing) the business-meaning-aware quality report above
    progress("Running validation checks")
    ge_validation = run_ge_validation(df, schema)

    analysis_id = str(uuid.uuid4())
    _ANALYSIS_DF_CACHE[analysis_id] = df
    _ANALYSIS_SCHEMA_CACHE[analysis_id] = schema

    progress("Finalizing")
    response = {
        "analysis_id": analysis_id,
        "filename": filename,
        "row_count": len(df),
        "column_count": len(df.columns),
        "memory_usage_bytes": int(df.memory_usage(deep=True).sum()),
        "domain": domain,
        "schema": [asdict(c) for c in schema],
        "charts": [asdict(c) for c in charts],
        "graph": asdict(graph),
        "quality": asdict(quality),
        "forecast": forecast,
        "forecast_eligibility": forecast_eligibility,
        "forecastable_targets": forecastable_targets,
        "anomalies": anomalies,
        "multivariate_anomalies": multivariate_anomalies,
        "time_series_spikes": time_series_spikes,
        "seasonality": seasonality,
        "period_comparison": period_comparison,
        "correlations": [asdict(c) for c in correlations],
        "associations": [asdict(a) for a in associations],
        "root_cause": asdict(root_cause) if root_cause else None,
        "distributions": distributions,
        "ranked_findings": ranked_findings,
        "insight_timeline": insight_timeline,
        "risk_alerts": risk_alerts,
        "clustering": clustering,
        "ge_validation": ge_validation,
        "decisions": build_decision_actions(schema),
        "primary_metric": primary_metric,
    }
    _ANALYSIS_RESULT_CACHE[analysis_id] = response

    catalog.save_dataset(
        analysis_id=analysis_id,
        username=username,
        filename=filename or "upload",
        row_count=len(df),
        column_count=len(df.columns),
        domain=domain,
        quality_score=quality.score,
        schema=schema,
        result=response,
    )

    logger.info(
        "Analysis completed: analysis_id={analysis_id} filename={filename} rows={rows} domain={domain}",
        analysis_id=analysis_id,
        filename=filename,
        rows=len(df),
        domain=domain,
    )
    return response


@protected.post("/api/analyze")
async def analyze(file: UploadFile, current_user: str = Depends(get_current_user)) -> dict:
    content = await file.read()
    return _run_analysis(file.filename or "upload.csv", content, current_user)


@protected.post("/api/analyze/start")
async def start_analyze_job(file: UploadFile, current_user: str = Depends(get_current_user)) -> dict:
    """Kicks off analysis in a background thread and returns a job_id to
    watch over WS /ws/analyze/{job_id} for live step-by-step progress —
    useful for larger files where the multi-model forecast backtest alone
    can take several seconds."""
    content = await file.read()
    filename = file.filename or "upload.csv"
    job = create_job()

    async def run() -> None:
        try:
            result = await asyncio.to_thread(_run_analysis, filename, content, current_user, job.progress)
            job.finish(result)
        except HTTPException as exc:
            job.fail(str(exc.detail))
        except Exception as exc:  # pragma: no cover - unexpected failure
            logger.exception("Unexpected failure in analysis job {job_id}", job_id=job.id)
            job.fail(str(exc))

    asyncio.create_task(run())
    return {"job_id": job.id}


@app.websocket("/ws/analyze/{job_id}")
async def analyze_progress_ws(websocket: WebSocket, job_id: str) -> None:
    # Browsers can't set a custom Authorization header on the WS handshake,
    # so the token travels as a query param instead — same JWT, same
    # decode_access_token() check as every other endpoint.
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return
    try:
        decode_access_token(token)
    except AuthError:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    job = get_job(job_id)
    if job is None:
        await websocket.send_json({"type": "error", "detail": "Unknown job_id."})
        await websocket.close()
        return

    sent = 0
    try:
        while True:
            while sent < len(job.log):
                await websocket.send_json(job.log[sent])
                sent += 1
            if job.status != "running":
                break
            await job.wait_for_update()
    except WebSocketDisconnect:
        pass
    finally:
        await websocket.close()


class InsightsRequest(BaseModel):
    domain: str
    row_count: int
    columns: list[dict]
    anomalies: list[dict] = []
    forecast: dict | None = None
    quality: dict | None = None
    root_cause: dict | None = None
    period_comparison: dict | None = None


@protected.post("/api/insights")
async def insights(req: InsightsRequest) -> dict:
    try:
        result = await generate_insights(
            req.domain,
            req.row_count,
            req.columns,
            req.anomalies,
            req.forecast,
            req.quality,
            req.root_cause,
            req.period_comparison,
        )
    except InsightsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return result


class AskRequest(BaseModel):
    analysis_id: str
    domain: str
    question: str
    primary_metric: str | None = None


@protected.post("/api/ask")
async def ask(req: AskRequest) -> dict:
    df = _ANALYSIS_DF_CACHE.get(req.analysis_id)
    schema = _ANALYSIS_SCHEMA_CACHE.get(req.analysis_id)
    if df is None or schema is None:
        raise HTTPException(status_code=404, detail="Analysis not found — re-upload the file and try again.")

    try:
        result = await answer_question(df, schema, req.domain, req.question, req.primary_metric)
    except InsightsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return result


class SimulateRequest(BaseModel):
    analysis_id: str
    driver_column: str
    pct_change: float


@protected.post("/api/simulate")
def simulate(req: SimulateRequest) -> dict:
    df = _ANALYSIS_DF_CACHE.get(req.analysis_id)
    schema = _ANALYSIS_SCHEMA_CACHE.get(req.analysis_id)
    if df is None or schema is None:
        raise HTTPException(status_code=404, detail="Analysis not found — re-upload the file and try again.")
    if req.driver_column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Unknown column: {req.driver_column}")

    result = _simulation_engine.propagate(df, schema, req.driver_column, req.pct_change)
    return asdict(result)


class ExplainSimulationRequest(BaseModel):
    domain: str
    simulation: dict


@protected.post("/api/simulate/explain")
async def explain_simulation(req: ExplainSimulationRequest) -> dict:
    try:
        result = await generate_simulation_explanation(req.domain, req.simulation)
    except InsightsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return result


class ForecastRequest(BaseModel):
    analysis_id: str
    column: str


@protected.post("/api/forecast")
def forecast_column(req: ForecastRequest) -> dict:
    df = _ANALYSIS_DF_CACHE.get(req.analysis_id)
    schema = _ANALYSIS_SCHEMA_CACHE.get(req.analysis_id)
    if df is None or schema is None:
        raise HTTPException(status_code=404, detail="Analysis not found — re-upload the file and try again.")

    col_schema = next((c for c in schema if c.name == req.column), None)
    if col_schema is None or col_schema.type != "numeric":
        raise HTTPException(status_code=400, detail=f"'{req.column}' is not a forecastable numeric column.")

    date_col = next((c for c in schema if c.type == "date"), None)
    if date_col is None:
        raise HTTPException(status_code=400, detail="No date column available for forecasting.")

    series = monthly_series(df, date_col.name, req.column)
    eligibility = check_forecast_eligibility(True, True, len(series))
    if not eligibility["eligible"]:
        raise HTTPException(status_code=400, detail=eligibility["reason"])

    result = select_and_forecast(series)
    result["column"] = col_schema.semantic_label
    return result


class ExplainForecastRequest(BaseModel):
    domain: str
    forecast: dict


@protected.post("/api/forecast/explain")
async def explain_forecast(req: ExplainForecastRequest) -> dict:
    try:
        summary = await generate_forecast_explanation(req.domain, req.forecast)
    except InsightsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"summary": summary}


class SummaryRequest(BaseModel):
    domain: str
    row_count: int
    column_count: int
    columns: list[dict]
    quality: dict | None = None


@protected.post("/api/summary")
async def dataset_summary(req: SummaryRequest) -> dict:
    try:
        summary = await generate_dataset_summary(req.domain, req.row_count, req.column_count, req.columns, req.quality)
    except InsightsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"summary": summary}


@protected.get("/api/datasets")
def list_datasets(current_user: str = Depends(get_current_user)) -> dict:
    return {"datasets": catalog.list_datasets(current_user)}


@protected.get("/api/datasets/{analysis_id}")
def get_dataset(analysis_id: str, current_user: str = Depends(get_current_user)) -> dict:
    record = catalog.get_dataset(analysis_id, current_user)
    if record is None:
        raise HTTPException(status_code=404, detail="Dataset not found in catalog.")
    return record


class UpdateLabelRequest(BaseModel):
    label: str


@protected.patch("/api/datasets/{analysis_id}/columns/{column_name}")
def update_column_label(
    analysis_id: str, column_name: str, req: UpdateLabelRequest, current_user: str = Depends(get_current_user)
) -> dict:
    updated = catalog.update_semantic_label(analysis_id, current_user, column_name, req.label)
    if not updated:
        raise HTTPException(status_code=404, detail="Dataset or column not found.")

    # keep the live in-memory session (if still cached) consistent with the
    # correction, so simulate/insights/ask reflect it without a re-upload
    schema = _ANALYSIS_SCHEMA_CACHE.get(analysis_id)
    if schema:
        for col in schema:
            if col.name == column_name:
                col.semantic_label = req.label
                col.confidence = 1.0
                break

    return {"updated": True}


class SaveForecastRequest(BaseModel):
    label: str
    forecast: dict


@protected.post("/api/analyze/{analysis_id}/forecasts")
def save_forecast(
    analysis_id: str, req: SaveForecastRequest, current_user: str = Depends(get_current_user)
) -> dict:
    saved_id = catalog.save_forecast(analysis_id, current_user, req.label, req.forecast)
    return {"id": saved_id}


@protected.get("/api/analyze/{analysis_id}/forecasts")
def list_saved_forecasts(analysis_id: str, current_user: str = Depends(get_current_user)) -> dict:
    return {"forecasts": catalog.list_saved_forecasts(analysis_id, current_user)}


class SaveSimulationRequest(BaseModel):
    label: str
    simulation: dict


@protected.post("/api/analyze/{analysis_id}/simulations")
def save_simulation(
    analysis_id: str, req: SaveSimulationRequest, current_user: str = Depends(get_current_user)
) -> dict:
    saved_id = catalog.save_simulation(analysis_id, current_user, req.label, req.simulation)
    return {"id": saved_id}


@protected.get("/api/analyze/{analysis_id}/simulations")
def list_saved_simulations(analysis_id: str, current_user: str = Depends(get_current_user)) -> dict:
    return {"simulations": catalog.list_saved_simulations(analysis_id, current_user)}


# --- V5: multi-table workspaces ------------------------------------------------


def _table_name_from_filename(filename: str) -> str:
    name = filename.rsplit(".", 1)[0]
    return re.sub(r"[^A-Za-z0-9_]", "_", name)


@protected.post("/api/workspace")
async def create_workspace(files: list[UploadFile]) -> dict:
    if not files:
        raise HTTPException(status_code=400, detail="Upload at least one file.")

    tables: dict[str, pd.DataFrame] = {}
    schemas: dict[str, list[ColumnSchema]] = {}
    table_summaries = []

    for file in files:
        content = await file.read()
        if not content:
            continue
        try:
            df = _read_dataframe(file.filename or "table.csv", content)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Could not parse '{file.filename}': {exc}") from exc
        if df.empty:
            continue

        table_name = _table_name_from_filename(file.filename or f"table_{len(tables)}")
        schema = build_schema(df)
        tables[table_name] = df
        schemas[table_name] = schema
        table_summaries.append(
            {
                "table": table_name,
                "filename": file.filename,
                "row_count": len(df),
                "column_count": len(df.columns),
                "schema": [asdict(c) for c in schema],
            }
        )

    if len(tables) < 1:
        raise HTTPException(status_code=400, detail="No valid, non-empty tables were uploaded.")

    workspace_id = str(uuid.uuid4())
    _WORKSPACE_TABLES_CACHE[workspace_id] = tables
    _WORKSPACE_SCHEMAS_CACHE[workspace_id] = schemas

    suggested = discover_relationships(tables, schemas) if len(tables) > 1 else []

    return {
        "workspace_id": workspace_id,
        "tables": table_summaries,
        "suggested_relationships": [asdict(r) for r in suggested],
    }


class RelationshipInput(BaseModel):
    from_table: str
    from_column: str
    to_table: str
    to_column: str
    confidence: float = 1.0
    overlap_pct: float = 0.0
    to_column_is_unique: bool = False
    relationship_type: str = "many_to_one"
    evidence: str = "User-confirmed relationship."


class ConfirmRelationshipsRequest(BaseModel):
    relationships: list[RelationshipInput]


@protected.post("/api/workspace/{workspace_id}/relationships")
def confirm_relationships(workspace_id: str, req: ConfirmRelationshipsRequest) -> dict:
    tables = _WORKSPACE_TABLES_CACHE.get(workspace_id)
    schemas = _WORKSPACE_SCHEMAS_CACHE.get(workspace_id)
    if tables is None or schemas is None:
        raise HTTPException(status_code=404, detail="Workspace not found — re-upload the files and try again.")

    relationships = [RelationshipCandidate(**r.model_dump()) for r in req.relationships]
    for rel in relationships:
        if rel.from_table not in tables or rel.to_table not in tables:
            raise HTTPException(status_code=400, detail=f"Unknown table in relationship: {rel.from_table} -> {rel.to_table}")

    try:
        result = build_graph(workspace_id, tables, schemas, relationships)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not write to Neo4j: {exc}") from exc

    graph = result["graph"]
    _WORKSPACE_GRAPH_CACHE[workspace_id] = graph
    analytics = compute_graph_analytics(graph)

    return {
        "node_count": result["node_count"],
        "edge_count": result["edge_count"],
        "analytics": analytics,
    }


@protected.get("/api/workspace/{workspace_id}/graph")
def get_workspace_graph(workspace_id: str, max_nodes: int = 150) -> dict:
    graph = _WORKSPACE_GRAPH_CACHE.get(workspace_id)
    if graph is None:
        raise HTTPException(status_code=404, detail="No confirmed graph for this workspace yet.")

    degrees = dict(graph.degree())
    top_nodes = sorted(degrees, key=lambda n: degrees[n], reverse=True)[:max_nodes]
    top_node_set = set(top_nodes)

    nodes = [
        {"id": n, "table": graph.nodes[n].get("table"), "key": graph.nodes[n].get("key"), "degree": degrees[n]}
        for n in top_nodes
    ]
    edges = [
        {"source": u, "target": v, "type": data.get("type")}
        for u, v, data in graph.edges(data=True)
        if u in top_node_set and v in top_node_set
    ]

    return {"nodes": nodes, "edges": edges, "total_nodes": graph.number_of_nodes(), "total_edges": graph.number_of_edges()}


@protected.get("/api/workspace/{workspace_id}/entity/{table}/{key}")
def get_entity_profile(workspace_id: str, table: str, key: str) -> dict:
    if workspace_id not in _WORKSPACE_TABLES_CACHE:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    driver = get_driver()
    with driver.session() as session:
        record = session.run(
            f"MATCH (n:`{table}` {{_workspace_id: $wid, _key: $key}}) RETURN properties(n) AS props",
            wid=workspace_id,
            key=key,
        ).single()
        if record is None:
            raise HTTPException(status_code=404, detail="Entity not found in the graph.")
        properties = {k: v for k, v in record["props"].items() if not k.startswith("_")}

        neighbors = session.run(
            f"""
            MATCH (n:`{table}` {{_workspace_id: $wid, _key: $key}})-[r]-(m)
            RETURN labels(m)[0] AS table, m._key AS key, type(r) AS relationship,
                   startNode(r)._key = $key AS outgoing
            LIMIT 25
            """,
            wid=workspace_id,
            key=key,
        )
        neighbor_list = [
            {
                "table": n["table"],
                "key": n["key"],
                "relationship": n["relationship"],
                "direction": "outgoing" if n["outgoing"] else "incoming",
            }
            for n in neighbors
        ]

    return {"table": table, "key": key, "properties": properties, "neighbors": neighbor_list}


class EntityImpactRequest(BaseModel):
    table: str
    key: str
    pct_change: float


@protected.post("/api/workspace/{workspace_id}/simulate-entity")
def simulate_entity(workspace_id: str, req: EntityImpactRequest) -> dict:
    graph = _WORKSPACE_GRAPH_CACHE.get(workspace_id)
    if graph is None:
        raise HTTPException(status_code=404, detail="No confirmed graph for this workspace yet.")

    source_node = f"{req.table}:{req.key}"
    result = simulate_entity_impact(graph, source_node, req.pct_change)
    if result is None:
        raise HTTPException(status_code=404, detail="Entity not found in the graph.")
    return result


# --- V7 (lean): autonomous action plan -----------------------------------------


class ActionPlanRequest(BaseModel):
    analysis_id: str
    domain: str
    ranked_findings: list[dict] = []
    risk_alerts: list[dict] = []
    root_cause: dict | None = None
    forecast: dict | None = None
    quality: dict | None = None


@protected.post("/api/action-plan")
async def action_plan(req: ActionPlanRequest) -> dict:
    df = _ANALYSIS_DF_CACHE.get(req.analysis_id)
    schema = _ANALYSIS_SCHEMA_CACHE.get(req.analysis_id)
    if df is None or schema is None:
        raise HTTPException(status_code=404, detail="Analysis not found — re-upload the file and try again.")

    # ground the plan in one real simulation, not just a described possibility
    numeric_cols = [c for c in schema if c.type == "numeric"]
    simulation_preview = None
    if numeric_cols:
        try:
            sim = _simulation_engine.propagate(df, schema, numeric_cols[0].name, 20.0)
            simulation_preview = asdict(sim)
        except Exception:
            simulation_preview = None

    try:
        plan = await generate_action_plan(
            req.domain,
            req.ranked_findings,
            req.risk_alerts,
            req.root_cause,
            req.forecast,
            req.quality,
            simulation_preview,
        )
    except InsightsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return plan


class QueryRequest(BaseModel):
    sql: str


@protected.post("/api/analyze/{analysis_id}/query")
def query_dataset(analysis_id: str, req: QueryRequest) -> dict:
    df = _ANALYSIS_DF_CACHE.get(analysis_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Analysis not found — re-upload the file and try again.")
    try:
        return run_query(df, req.sql)
    except UnsafeQueryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


_REPORT_CONTENT_TYPES = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}


@protected.get("/api/analyze/{analysis_id}/report")
def export_report(analysis_id: str, format: str = "pdf") -> Response:
    if format not in _REPORT_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="format must be one of: xlsx, pdf, pptx")

    result = _ANALYSIS_RESULT_CACHE.get(analysis_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Analysis not found — re-upload the file and try again.")

    if format == "xlsx":
        df = _ANALYSIS_DF_CACHE.get(analysis_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Analysis not found — re-upload the file and try again.")
        content = build_excel_report(result, df)
    elif format == "pptx":
        content = build_pptx_report(result)
    else:
        content = build_pdf_report(result)

    filename = f"nexus-report-{analysis_id[:8]}.{format}"
    return Response(
        content=content,
        media_type=_REPORT_CONTENT_TYPES[format],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


app.include_router(protected)
