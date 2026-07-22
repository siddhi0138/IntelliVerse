import io
from dataclasses import asdict

from dotenv import load_dotenv

load_dotenv()  # must run before `insights` reads FREELLMAPI_* env vars at import time

import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from analytics import detect_anomalies, forecast_next_periods
from graph_builder import build_knowledge_graph
from insights import InsightsUnavailable, generate_insights
from schema_inference import build_schema, guess_domain, monthly_series, suggest_charts

app = FastAPI(title="NEXUS API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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

    forecast = None
    if date_cols and numeric_cols:
        series = monthly_series(df, date_cols[0].name, numeric_cols[0].name)
        if series:
            forecast = forecast_next_periods(series)
            forecast["column"] = numeric_cols[0].semantic_label

    anomalies = detect_anomalies(df, schema, id_column=id_cols[0].name if id_cols else None)

    return {
        "filename": file.filename,
        "row_count": len(df),
        "column_count": len(df.columns),
        "domain": domain,
        "schema": [asdict(c) for c in schema],
        "charts": [asdict(c) for c in charts],
        "graph": asdict(graph),
        "forecast": forecast,
        "anomalies": anomalies,
    }


class InsightsRequest(BaseModel):
    domain: str
    row_count: int
    columns: list[dict]
    anomalies: list[dict] = []
    forecast: dict | None = None


@app.post("/api/insights")
async def insights(req: InsightsRequest) -> dict:
    try:
        result = await generate_insights(req.domain, req.row_count, req.columns, req.anomalies, req.forecast)
    except InsightsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return result
