import io
from dataclasses import asdict

import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from schema_inference import build_schema, guess_domain, suggest_charts

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

    return {
        "filename": file.filename,
        "row_count": len(df),
        "column_count": len(df.columns),
        "domain": domain,
        "schema": [asdict(c) for c in schema],
        "charts": [asdict(c) for c in charts],
    }
