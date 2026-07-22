import io
import re
import uuid
from dataclasses import asdict

from dotenv import load_dotenv

load_dotenv()  # must run before `insights` reads FREELLMAPI_* env vars at import time

import networkx as nx
import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from analytics import detect_anomalies, detect_seasonality, detect_time_series_spikes, period_over_period
from anomalies_ml import detect_multivariate_anomalies
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
from knowledge_graph_builder import build_graph
from multi_table import RelationshipCandidate, discover_relationships
from neo4j_client import get_driver
from profiling import build_quality_report
from qa import answer_question
from relationships import categorical_associations, numeric_correlations, root_cause_breakdown
from risk_alerts import generate_risk_alerts
from schema_inference import ColumnSchema, build_schema, guess_domain, monthly_series, suggest_charts
from simulation import CorrelationRegressionEngine, build_decision_actions

app = FastAPI(title="NEXUS API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory, single-process cache so /api/simulate can re-use the parsed
# DataFrame without re-uploading the file. Fine for a local single-user dev
# tool; lost on restart, unbounded growth is not a concern at this scale.
_ANALYSIS_DF_CACHE: dict[str, pd.DataFrame] = {}
_ANALYSIS_SCHEMA_CACHE: dict[str, list[ColumnSchema]] = {}

# V5: multi-table workspaces (distinct from the single-table analysis cache
# above). Tables/schemas are the source of truth for re-running relationship
# discovery or rebuilding the graph; the NetworkX graph is cached after
# confirmation so /graph and /entity endpoints don't hit Neo4j on every call.
_WORKSPACE_TABLES_CACHE: dict[str, dict[str, pd.DataFrame]] = {}
_WORKSPACE_SCHEMAS_CACHE: dict[str, dict[str, list[ColumnSchema]]] = {}
_WORKSPACE_GRAPH_CACHE: dict[str, nx.MultiDiGraph] = {}

_simulation_engine = CorrelationRegressionEngine()


def _read_dataframe(filename: str, content: bytes) -> pd.DataFrame:
    lowered = filename.lower()
    buffer = io.BytesIO(content)
    if lowered.endswith(".csv"):
        return pd.read_csv(buffer)
    if lowered.endswith((".xlsx", ".xls")):
        return pd.read_excel(buffer)
    if lowered.endswith(".json"):
        return pd.read_json(buffer)
    raise HTTPException(status_code=400, detail="Unsupported file type. Upload a .csv, .xlsx, or .json file.")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze(file: UploadFile) -> dict:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        df = _read_dataframe(file.filename or "upload.csv", content)
    except HTTPException:
        raise
    except Exception as exc:  # pandas parse errors, bad encoding, etc.
        raise HTTPException(status_code=400, detail=f"Could not parse file: {exc}") from exc

    if df.empty:
        raise HTTPException(status_code=400, detail="Uploaded file has no rows.")

    schema = build_schema(df)
    charts = suggest_charts(df, schema)
    domain = guess_domain(list(df.columns))
    graph = build_knowledge_graph(schema, domain)

    date_cols = [c for c in schema if c.type == "date"]
    numeric_cols = [c for c in schema if c.type == "numeric"]
    id_cols = [c for c in schema if c.type == "id"]
    primary_metric = numeric_cols[0].name if numeric_cols else None

    # v1 backfill: data quality profiling (duplicates, invalid values, score, recommendations)
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
        monthly = monthly_series(df, date_cols[0].name, numeric_cols[0].name)
        forecast_eligibility = check_forecast_eligibility(True, True, len(monthly))
        if forecast_eligibility["eligible"]:
            forecast = select_and_forecast(monthly)
            forecast["column"] = numeric_cols[0].semantic_label
        forecastable_targets = discover_forecastable_targets(df, schema, date_cols[0].name, monthly_series)

    anomalies = detect_anomalies(df, schema, id_column=id_cols[0].name if id_cols else None)
    multivariate_anomalies = detect_multivariate_anomalies(df, schema, id_column=id_cols[0].name if id_cols else None)
    time_series_spikes = detect_time_series_spikes(monthly) if monthly else []
    seasonality = detect_seasonality(monthly) if monthly else {"detected": False, "reason": "no_time_series"}
    period_comparison = period_over_period(monthly) if monthly else None

    # v2 backfill: relationship discovery + root cause
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
    clustering = cluster_rows(df, schema, id_column=id_cols[0].name if id_cols else None)

    # additive: Great Expectations as a supplementary structural sanity check,
    # layered on top of (not replacing) the business-meaning-aware quality report above
    ge_validation = run_ge_validation(df, schema)

    analysis_id = str(uuid.uuid4())
    _ANALYSIS_DF_CACHE[analysis_id] = df
    _ANALYSIS_SCHEMA_CACHE[analysis_id] = schema

    catalog.save_dataset(
        analysis_id=analysis_id,
        filename=file.filename or "upload",
        row_count=len(df),
        column_count=len(df.columns),
        domain=domain,
        quality_score=quality.score,
        schema=schema,
    )

    return {
        "analysis_id": analysis_id,
        "filename": file.filename,
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


class InsightsRequest(BaseModel):
    domain: str
    row_count: int
    columns: list[dict]
    anomalies: list[dict] = []
    forecast: dict | None = None
    quality: dict | None = None
    root_cause: dict | None = None
    period_comparison: dict | None = None


@app.post("/api/insights")
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


@app.post("/api/ask")
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


@app.post("/api/simulate")
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


@app.post("/api/simulate/explain")
async def explain_simulation(req: ExplainSimulationRequest) -> dict:
    try:
        result = await generate_simulation_explanation(req.domain, req.simulation)
    except InsightsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return result


class ForecastRequest(BaseModel):
    analysis_id: str
    column: str


@app.post("/api/forecast")
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


@app.post("/api/forecast/explain")
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


@app.post("/api/summary")
async def dataset_summary(req: SummaryRequest) -> dict:
    try:
        summary = await generate_dataset_summary(req.domain, req.row_count, req.column_count, req.columns, req.quality)
    except InsightsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"summary": summary}


@app.get("/api/datasets")
def list_datasets() -> dict:
    return {"datasets": catalog.list_datasets()}


@app.get("/api/datasets/{analysis_id}")
def get_dataset(analysis_id: str) -> dict:
    record = catalog.get_dataset(analysis_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Dataset not found in catalog.")
    return record


class UpdateLabelRequest(BaseModel):
    label: str


@app.patch("/api/datasets/{analysis_id}/columns/{column_name}")
def update_column_label(analysis_id: str, column_name: str, req: UpdateLabelRequest) -> dict:
    updated = catalog.update_semantic_label(analysis_id, column_name, req.label)
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


# --- V5: multi-table workspaces ------------------------------------------------


def _table_name_from_filename(filename: str) -> str:
    name = filename.rsplit(".", 1)[0]
    return re.sub(r"[^A-Za-z0-9_]", "_", name)


@app.post("/api/workspace")
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


@app.post("/api/workspace/{workspace_id}/relationships")
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


@app.get("/api/workspace/{workspace_id}/graph")
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


@app.get("/api/workspace/{workspace_id}/entity/{table}/{key}")
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
