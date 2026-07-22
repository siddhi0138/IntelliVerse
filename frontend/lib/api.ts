import type {
  ActionPlanResult,
  AnalyzeResponse,
  Anomaly,
  AskResponse,
  CatalogEntry,
  ColumnSchema,
  ConfirmRelationshipsResponse,
  DataQualityReport,
  EntityImpactResult,
  EntityProfile,
  Forecast,
  Insight,
  PeriodComparison,
  QueryResult,
  RankedFinding,
  Recommendation,
  RelationshipCandidate,
  RiskAlert,
  RootCauseAnalysis,
  SimulationExplanation,
  SimulationResult,
  WorkspaceGraph,
  WorkspaceResponse,
} from "./types";



const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001";
const WS_BASE = API_BASE.replace(/^http/, "ws");

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function analyzeFileWithProgress(
  file: File,
  onProgress: (step: string) => void
): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/analyze/start`, {
    method: "POST",
    body: formData,
  });
  const { job_id } = await unwrap<{ job_id: string }>(res);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_BASE}/ws/analyze/${job_id}`);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "progress") {
        onProgress(msg.step);
      } else if (msg.type === "done") {
        ws.close();
        resolve(msg.result as AnalyzeResponse);
      } else if (msg.type === "error") {
        ws.close();
        reject(new Error(msg.detail));
      }
    };
    ws.onerror = () => reject(new Error("Lost connection while analyzing."));
  });
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

export async function createWorkspace(files: File[]): Promise<WorkspaceResponse> {
  const formData = new FormData();
  for (const file of files) formData.append("files", file);

  const res = await fetch(`${API_BASE}/api/workspace`, {
    method: "POST",
    body: formData,
  });

  return unwrap<WorkspaceResponse>(res);
}

export async function confirmRelationships(
  workspaceId: string,
  relationships: RelationshipCandidate[]
): Promise<ConfirmRelationshipsResponse> {
  const res = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(workspaceId)}/relationships`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ relationships }),
  });

  return unwrap<ConfirmRelationshipsResponse>(res);
}

export async function fetchWorkspaceGraph(workspaceId: string): Promise<WorkspaceGraph> {
  const res = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(workspaceId)}/graph`);
  return unwrap<WorkspaceGraph>(res);
}

export async function fetchEntityProfile(workspaceId: string, table: string, key: string): Promise<EntityProfile> {
  const res = await fetch(
    `${API_BASE}/api/workspace/${encodeURIComponent(workspaceId)}/entity/${encodeURIComponent(table)}/${encodeURIComponent(key)}`
  );
  return unwrap<EntityProfile>(res);
}

export async function simulateEntityImpact(
  workspaceId: string,
  table: string,
  key: string,
  pctChange: number
): Promise<EntityImpactResult> {
  const res = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(workspaceId)}/simulate-entity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table, key, pct_change: pctChange }),
  });
  return unwrap<EntityImpactResult>(res);
}

export async function generateActionPlan(
  analysisId: string,
  domain: string,
  rankedFindings: RankedFinding[],
  riskAlerts: RiskAlert[],
  rootCause: RootCauseAnalysis | null,
  forecast: Forecast | null,
  quality: DataQualityReport | null
): Promise<ActionPlanResult> {
  const res = await fetch(`${API_BASE}/api/action-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      analysis_id: analysisId,
      domain,
      ranked_findings: rankedFindings,
      risk_alerts: riskAlerts,
      root_cause: rootCause,
      forecast,
      quality,
    }),
  });
  return unwrap<ActionPlanResult>(res);
}

export function reportUrl(analysisId: string, format: "xlsx" | "pdf" | "pptx"): string {
  return `${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/report?format=${format}`;
}

export async function runSqlQuery(analysisId: string, sql: string): Promise<QueryResult> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  });
  return unwrap<QueryResult>(res);
}
