import type { AnalyzeResponse, ColumnSchema, Insight } from "./types";

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

export async function fetchInsights(
  domain: string,
  rowCount: number,
  schema: ColumnSchema[]
): Promise<Insight[]> {
  const res = await fetch(`${API_BASE}/api/insights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain, row_count: rowCount, columns: schema }),
  });

  const body = await unwrap<{ insights: Insight[] }>(res);
  return body.insights;
}
