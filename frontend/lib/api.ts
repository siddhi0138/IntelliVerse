import type {
  ActionPlanResult,
  AnalyzeResponse,
  AskDocumentsResponse,
  AskResponse,
  CatalogDetail,
  CatalogEntry,
  ColumnSchema,
  ConfirmRelationshipsResponse,
  DataQualityReport,
  DocumentEntry,
  EntityImpactResult,
  EntityProfile,
  Forecast,
  LiveStreamEvent,
  ModelHistoryEntry,
  OptimizationResult,
  QueryResult,
  RankedFinding,
  RelationshipCandidate,
  RiskAlert,
  RootCauseAnalysis,
  SavedActionPlan,
  SavedForecast,
  SavedOptimization,
  SavedQuery,
  SavedSimulation,
  SimulationExplanation,
  SimulationResult,
  WorkspaceGraph,
  WorkspaceMetadata,
  WorkspaceResponse,
} from "./types";
import { clearToken, getToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001";
const WS_BASE = API_BASE.replace(/^http/, "ws");

// Mirrors MAX_UPLOAD_BYTES in backend/main.py — checked client-side too so
// a large file is rejected instantly instead of after a slow upload.
export const MAX_UPLOAD_BYTES = 25_000_000;

export function checkUploadSize(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `'${file.name}' is ${(file.size / 1_000_000).toFixed(1)}MB, over the ${MAX_UPLOAD_BYTES / 1_000_000}MB upload limit.`;
  }
  return null;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function unwrap<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    // A stale/expired token surfaced as a raw backend error message
    // ("Invalid or expired token.") on whatever page the user happened to
    // be on — e.g. mid-upload — instead of sending them back to sign in.
    // Every API call funnels through here, so this is the one place that
    // needs to catch it.
    clearToken();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new Error("Your session expired — please sign in again.");
  }
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
    headers: authHeaders(),
    body: formData,
  });
  const { job_id } = await unwrap<{ job_id: string }>(res);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_BASE}/ws/analyze/${job_id}?token=${encodeURIComponent(getToken() ?? "")}`);
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

// Re-runs the full analysis pipeline against whatever's currently in the
// backend's cached DataFrame for this id — the manual way to pick up rows a
// live stream has appended, since the rest of the dashboard (KPIs, schema,
// stats, forecast, anomalies, action plan) is a snapshot from upload time
// and doesn't recompute automatically per incoming row.
export async function refreshAnalysis(analysisId: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/refresh`, {
    method: "POST",
    headers: authHeaders(),
  });
  return unwrap<AnalyzeResponse>(res);
}

export async function askQuestion(
  analysisId: string,
  domain: string,
  question: string,
  primaryMetric: string | null
): Promise<AskResponse> {
  const res = await fetch(`${API_BASE}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ analysis_id: analysisId, domain, question, primary_metric: primaryMetric }),
  });

  return unwrap<AskResponse>(res);
}

export async function fetchAskHistory(analysisId: string): Promise<(AskResponse & { question: string })[]> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/ask-history`, {
    headers: authHeaders(),
  });
  const body = await unwrap<{ messages: (AskResponse & { question: string })[] }>(res);
  return body.messages;
}

export async function clearAskHistory(analysisId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/ask-history`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await unwrap<{ cleared: boolean }>(res);
}

export async function deleteAskHistoryEntry(analysisId: string, index: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/ask-history/${index}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await unwrap<{ deleted: boolean }>(res);
}

export async function runSimulation(
  analysisId: string,
  driverColumn: string,
  pctChange: number
): Promise<SimulationResult> {
  const res = await fetch(`${API_BASE}/api/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ analysis_id: analysisId, driver_column: driverColumn, pct_change: pctChange }),
  });

  return unwrap<SimulationResult>(res);
}

export async function explainSimulation(
  analysisId: string,
  domain: string,
  simulation: SimulationResult,
  persona?: string | null,
  simpleMode?: boolean
): Promise<SimulationExplanation> {
  const res = await fetch(`${API_BASE}/api/simulate/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ analysis_id: analysisId, domain, simulation, persona, simple_mode: simpleMode }),
  });

  return unwrap<SimulationExplanation>(res);
}

export async function fetchStreamStatus(analysisId: string): Promise<{ running: boolean; row_count: number | null }> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/stream/status`, {
    headers: authHeaders(),
  });
  return unwrap<{ running: boolean; row_count: number | null }>(res);
}

export async function startLiveStream(analysisId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/stream/start`, {
    method: "POST",
    headers: authHeaders(),
  });
  await unwrap<{ running: boolean }>(res);
}

export async function stopLiveStream(analysisId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/stream/stop`, {
    method: "POST",
    headers: authHeaders(),
  });
  await unwrap<{ running: boolean }>(res);
}

export function openLiveStreamSocket(analysisId: string, onEvent: (event: LiveStreamEvent) => void): () => void {
  const ws = new WebSocket(
    `${WS_BASE}/ws/live/${encodeURIComponent(analysisId)}?token=${encodeURIComponent(getToken() ?? "")}`
  );
  ws.onmessage = (event) => {
    try {
      onEvent(JSON.parse(event.data) as LiveStreamEvent);
    } catch {
      // ignore malformed frames
    }
  };
  return () => ws.close();
}

export async function fetchModelHistory(analysisId: string, targetColumn: string): Promise<ModelHistoryEntry[]> {
  const res = await fetch(
    `${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/model-history?target_column=${encodeURIComponent(targetColumn)}`,
    { headers: authHeaders() }
  );
  const body = await unwrap<{ updates: ModelHistoryEntry[] }>(res);
  return body.updates;
}

export async function optimizeScenario(
  analysisId: string,
  domain: string,
  targetColumn: string,
  leverColumns: string[],
  budgetPct: number | null,
  persona?: string | null,
  simpleMode?: boolean
): Promise<OptimizationResult> {
  const res = await fetch(`${API_BASE}/api/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      analysis_id: analysisId,
      domain,
      target_column: targetColumn,
      lever_columns: leverColumns,
      budget_pct: budgetPct,
      persona,
      simple_mode: simpleMode,
    }),
  });

  return unwrap<OptimizationResult>(res);
}

export async function fetchDatasetSummary(
  analysisId: string,
  domain: string,
  rowCount: number,
  columnCount: number,
  schema: ColumnSchema[],
  quality: DataQualityReport | null,
  persona?: string | null,
  simpleMode?: boolean
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      analysis_id: analysisId,
      domain,
      row_count: rowCount,
      column_count: columnCount,
      columns: schema,
      quality,
      persona,
      simple_mode: simpleMode,
    }),
  });

  const body = await unwrap<{ summary: string }>(res);
  return body.summary;
}

export async function listDatasets(): Promise<CatalogEntry[]> {
  const res = await fetch(`${API_BASE}/api/datasets`, { headers: authHeaders() });
  const body = await unwrap<{ datasets: CatalogEntry[] }>(res);
  return body.datasets;
}

export async function fetchCatalogDataset(analysisId: string): Promise<CatalogDetail> {
  const res = await fetch(`${API_BASE}/api/datasets/${encodeURIComponent(analysisId)}`, { headers: authHeaders() });
  return unwrap<CatalogDetail>(res);
}

export async function deleteDataset(analysisId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/datasets/${encodeURIComponent(analysisId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await unwrap<{ deleted: boolean }>(res);
}

export async function deleteAllDatasets(): Promise<number> {
  const res = await fetch(`${API_BASE}/api/datasets`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const body = await unwrap<{ deleted_count: number }>(res);
  return body.deleted_count;
}

export async function saveForecast(
  analysisId: string,
  label: string,
  forecast: Forecast,
  persona?: string | null
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/forecasts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ label, forecast, persona }),
  });
  await unwrap<{ id: string }>(res);
}

export async function listSavedForecasts(analysisId: string): Promise<SavedForecast[]> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/forecasts`, {
    headers: authHeaders(),
  });
  const body = await unwrap<{ forecasts: SavedForecast[] }>(res);
  return body.forecasts;
}

export async function deleteSavedForecast(analysisId: string, savedId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/forecasts/${encodeURIComponent(savedId)}`,
    { method: "DELETE", headers: authHeaders() }
  );
  await unwrap<{ deleted: boolean }>(res);
}

export async function saveSimulation(
  analysisId: string,
  label: string,
  simulation: SimulationResult,
  persona?: string | null
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/simulations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ label, simulation, persona }),
  });
  await unwrap<{ id: string }>(res);
}

export async function listSavedSimulations(analysisId: string): Promise<SavedSimulation[]> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/simulations`, {
    headers: authHeaders(),
  });
  const body = await unwrap<{ simulations: SavedSimulation[] }>(res);
  return body.simulations;
}

export async function deleteSavedSimulation(analysisId: string, savedId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/simulations/${encodeURIComponent(savedId)}`,
    { method: "DELETE", headers: authHeaders() }
  );
  await unwrap<{ deleted: boolean }>(res);
}

export async function saveActionPlan(
  analysisId: string,
  label: string,
  plan: ActionPlanResult,
  persona?: string | null
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/action-plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ label, plan, persona }),
  });
  await unwrap<{ id: string }>(res);
}

export async function listSavedActionPlans(analysisId: string): Promise<SavedActionPlan[]> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/action-plans`, {
    headers: authHeaders(),
  });
  const body = await unwrap<{ action_plans: SavedActionPlan[] }>(res);
  return body.action_plans;
}

export async function deleteSavedActionPlan(analysisId: string, savedId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/action-plans/${encodeURIComponent(savedId)}`,
    { method: "DELETE", headers: authHeaders() }
  );
  await unwrap<{ deleted: boolean }>(res);
}

// Whatever "Find the best plan" run the user last computed for this dataset
// — fetched on mount so the result survives a refresh without requiring an
// explicit Save first (the explicit save/list/delete below is a separate,
// opt-in bookmark of a specific labeled run).
export async function fetchLastOptimization(analysisId: string): Promise<OptimizationResult | null> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/optimize/last`, {
    headers: authHeaders(),
  });
  const body = await unwrap<{ result: OptimizationResult | null }>(res);
  return body.result;
}

export async function saveOptimization(
  analysisId: string,
  label: string,
  result: OptimizationResult,
  persona?: string | null
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/optimizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ label, result, persona }),
  });
  await unwrap<{ id: string }>(res);
}

export async function listSavedOptimizations(analysisId: string): Promise<SavedOptimization[]> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/optimizations`, {
    headers: authHeaders(),
  });
  const body = await unwrap<{ optimizations: SavedOptimization[] }>(res);
  return body.optimizations;
}

export async function deleteSavedOptimization(analysisId: string, savedId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/optimizations/${encodeURIComponent(savedId)}`,
    { method: "DELETE", headers: authHeaders() }
  );
  await unwrap<{ deleted: boolean }>(res);
}

export async function updateSemanticLabel(analysisId: string, columnName: string, label: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/datasets/${encodeURIComponent(analysisId)}/columns/${encodeURIComponent(columnName)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ label }),
  });
  await unwrap<{ updated: boolean }>(res);
}

export async function forecastColumn(analysisId: string, column: string): Promise<Forecast> {
  const res = await fetch(`${API_BASE}/api/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ analysis_id: analysisId, column }),
  });

  return unwrap<Forecast>(res);
}

export async function explainForecast(
  analysisId: string,
  domain: string,
  forecast: Forecast,
  persona?: string | null,
  simpleMode?: boolean
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/forecast/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ analysis_id: analysisId, domain, forecast, persona, simple_mode: simpleMode }),
  });

  const body = await unwrap<{ summary: string }>(res);
  return body.summary;
}

export async function explainAnomaly(
  domain: string,
  columnLabel: string,
  value: number | string,
  direction: string,
  persona?: string | null,
  simpleMode?: boolean
): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/anomalies/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ domain, column_label: columnLabel, value, direction, persona, simple_mode: simpleMode }),
  });

  const body = await unwrap<{ reasons: string[] }>(res);
  return body.reasons;
}

export async function createWorkspace(files: File[]): Promise<WorkspaceResponse> {
  const formData = new FormData();
  for (const file of files) formData.append("files", file);

  const res = await fetch(`${API_BASE}/api/workspace`, {
    method: "POST",
    headers: authHeaders(),
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
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ relationships }),
  });

  return unwrap<ConfirmRelationshipsResponse>(res);
}

export async function fetchWorkspaceGraph(workspaceId: string): Promise<WorkspaceGraph> {
  const res = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(workspaceId)}/graph`, {
    headers: authHeaders(),
  });
  return unwrap<WorkspaceGraph>(res);
}

export async function fetchWorkspaceMetadata(workspaceId: string): Promise<WorkspaceMetadata> {
  const res = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(workspaceId)}`, {
    headers: authHeaders(),
  });
  return unwrap<WorkspaceMetadata>(res);
}

export async function saveWorkspace(workspaceId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(workspaceId)}/save`, {
    method: "POST",
    headers: authHeaders(),
  });
  const body = await unwrap<{ saved_at: string }>(res);
  return body.saved_at;
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(workspaceId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await unwrap<{ deleted: boolean }>(res);
}

export async function fetchEntityProfile(workspaceId: string, table: string, key: string): Promise<EntityProfile> {
  const res = await fetch(
    `${API_BASE}/api/workspace/${encodeURIComponent(workspaceId)}/entity/${encodeURIComponent(table)}/${encodeURIComponent(key)}`,
    { headers: authHeaders() }
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
    headers: { "Content-Type": "application/json", ...authHeaders() },
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
  quality: DataQualityReport | null,
  persona?: string | null,
  simpleMode?: boolean
): Promise<ActionPlanResult> {
  const res = await fetch(`${API_BASE}/api/action-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      analysis_id: analysisId,
      domain,
      ranked_findings: rankedFindings,
      risk_alerts: riskAlerts,
      root_cause: rootCause,
      forecast,
      quality,
      persona,
      simple_mode: simpleMode,
    }),
  });
  return unwrap<ActionPlanResult>(res);
}

export function reportUrl(analysisId: string, format: "xlsx" | "pdf" | "pptx"): string {
  // Plain <a href> download link — no custom headers possible on a browser
  // navigation, so the token rides as a query param (get_current_user on
  // the backend accepts either).
  const token = encodeURIComponent(getToken() ?? "");
  return `${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/report?format=${format}&token=${token}`;
}

export async function runSqlQuery(analysisId: string, sql: string): Promise<QueryResult> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ sql }),
  });
  return unwrap<QueryResult>(res);
}

export async function saveQuery(analysisId: string, label: string, sql: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/queries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ label, sql }),
  });
  await unwrap<{ id: string }>(res);
}

export async function listSavedQueries(analysisId: string): Promise<SavedQuery[]> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/queries`, {
    headers: authHeaders(),
  });
  const body = await unwrap<{ queries: SavedQuery[] }>(res);
  return body.queries;
}

export async function deleteSavedQuery(analysisId: string, savedId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/analyze/${encodeURIComponent(analysisId)}/queries/${encodeURIComponent(savedId)}`,
    { method: "DELETE", headers: authHeaders() }
  );
  await unwrap<{ deleted: boolean }>(res);
}

export async function uploadDocuments(files: File[]): Promise<{ documents: DocumentEntry[] }> {
  const formData = new FormData();
  for (const file of files) formData.append("files", file);

  const res = await fetch(`${API_BASE}/api/documents`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  return unwrap<{ documents: DocumentEntry[] }>(res);
}

export async function listDocuments(): Promise<DocumentEntry[]> {
  const res = await fetch(`${API_BASE}/api/documents`, { headers: authHeaders() });
  const body = await unwrap<{ documents: DocumentEntry[] }>(res);
  return body.documents;
}

export async function deleteDocument(docId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(docId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await unwrap<{ deleted: boolean }>(res);
}

export async function askDocuments(question: string, analysisId?: string): Promise<AskDocumentsResponse> {
  const res = await fetch(`${API_BASE}/api/ask-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ question, analysis_id: analysisId ?? null }),
  });
  return unwrap<AskDocumentsResponse>(res);
}
