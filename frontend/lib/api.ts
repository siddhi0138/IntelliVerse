import type {
  AnalyzeResponse,
  Anomaly,
  AskResponse,
  CatalogEntry,
  ColumnSchema,
  DataQualityReport,
  Forecast,
  Insight,
  PeriodComparison,
  Recommendation,
  RootCauseAnalysis,
  SimulationExplanation,
  SimulationResult,
} from "./types";



const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001";

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function analyzeFile(file: File): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    body: formData,
  });

  return unwrap<AnalyzeResponse>(res);
}

export interface InsightsResult {
  insights: Insight[];
  recommendations: Recommendation[];
}

export async function fetchInsights(
  domain: string,
  rowCount: number,
  schema: ColumnSchema[],
  anomalies: Anomaly[],
  forecast: Forecast | null,
  quality: DataQualityReport | null,
  rootCause: RootCauseAnalysis | null,
  periodComparison: PeriodComparison | null
): Promise<InsightsResult> {
  const res = await fetch(`${API_BASE}/api/insights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain,
      row_count: rowCount,
      columns: schema,
      anomalies,
      forecast,
      quality,
      root_cause: rootCause,
      period_comparison: periodComparison,
    }),
  });

  return unwrap<InsightsResult>(res);
}

export async function askQuestion(
  analysisId: string,
  domain: string,
  question: string,
  primaryMetric: string | null
): Promise<AskResponse> {
  const res = await fetch(`${API_BASE}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis_id: analysisId, domain, question, primary_metric: primaryMetric }),
  });

  return unwrap<AskResponse>(res);
}

export async function runSimulation(
  analysisId: string,
  driverColumn: string,
  pctChange: number
): Promise<SimulationResult> {
  const res = await fetch(`${API_BASE}/api/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis_id: analysisId, driver_column: driverColumn, pct_change: pctChange }),
  });

  return unwrap<SimulationResult>(res);
}

export async function explainSimulation(domain: string, simulation: SimulationResult): Promise<SimulationExplanation> {
  const res = await fetch(`${API_BASE}/api/simulate/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain, simulation }),
  });

  return unwrap<SimulationExplanation>(res);
}

export async function fetchDatasetSummary(
  domain: string,
  rowCount: number,
  columnCount: number,
  schema: ColumnSchema[],
  quality: DataQualityReport | null
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain, row_count: rowCount, column_count: columnCount, columns: schema, quality }),
  });

  const body = await unwrap<{ summary: string }>(res);
  return body.summary;
}

export async function listDatasets(): Promise<CatalogEntry[]> {
  const res = await fetch(`${API_BASE}/api/datasets`);
  const body = await unwrap<{ datasets: CatalogEntry[] }>(res);
  return body.datasets;
}

export async function updateSemanticLabel(analysisId: string, columnName: string, label: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/datasets/${encodeURIComponent(analysisId)}/columns/${encodeURIComponent(columnName)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  await unwrap<{ updated: boolean }>(res);
}

export async function forecastColumn(analysisId: string, column: string): Promise<Forecast> {
  const res = await fetch(`${API_BASE}/api/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis_id: analysisId, column }),
  });

  return unwrap<Forecast>(res);
}

export async function explainForecast(domain: string, forecast: Forecast): Promise<string> {
  const res = await fetch(`${API_BASE}/api/forecast/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain, forecast }),
  });

  const body = await unwrap<{ summary: string }>(res);
  return body.summary;
}
