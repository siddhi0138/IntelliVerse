export type ColumnType = "id" | "numeric" | "boolean" | "date" | "categorical" | "text";

export interface ColumnSchema {
  name: string;
  type: ColumnType;
  semantic_label: string;
  stats: Record<string, unknown>;
}

export interface ChartSpec {
  id: string;
  title: string;
  chart_type: "kpi" | "bar" | "line" | "pie";
  x: string | null;
  y: string | null;
  data: Record<string, unknown>[];
}

export type GraphNodeType = "root" | "entity" | "dimension" | "time" | "measure";

export interface GraphNode {
  id: string;
  label: string;
  node_type: GraphNodeType;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ForecastPoint {
  period: string;
  value: number;
  lower: number;
  upper: number;
}

export interface Forecast {
  history: { period: string; value: number }[];
  forecast: ForecastPoint[];
  method: "linear_trend" | "insufficient_data";
  trend?: "up" | "down" | "flat";
  column?: string;
}

export interface Anomaly {
  column: string;
  semantic_label: string;
  row: string;
  value: number;
  direction: "above" | "below";
  bounds: { lower: number; upper: number };
}

export interface AnalyzeResponse {
  filename: string;
  row_count: number;
  column_count: number;
  domain: string;
  schema: ColumnSchema[];
  charts: ChartSpec[];
  graph: KnowledgeGraph;
  forecast: Forecast | null;
  anomalies: Anomaly[];
}

export interface Insight {
  title: string;
  description: string;
  confidence: "high" | "medium" | "low";
}

export interface Recommendation {
  title: string;
  action: string;
  rationale: string;
}
