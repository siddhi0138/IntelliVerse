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

export interface AnalyzeResponse {
  filename: string;
  row_count: number;
  column_count: number;
  domain: string;
  schema: ColumnSchema[];
  charts: ChartSpec[];
}
