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

export interface ForecastValidation {
  holdout_periods: number;
  chosen_model: string;
  metrics: { rmse: number; mae: number; mape: number | null };
  all_candidates: { model: string; rmse: number; mae: number; mape: number | null }[];
}

export interface Forecast {
  history: { period: string; value: number }[];
  forecast: ForecastPoint[];
  method: "linear_trend" | "naive" | "holt_linear_trend" | "insufficient_data";
  trend?: "up" | "down" | "flat";
  column?: string;
  validation?: ForecastValidation | null;
}

export interface ForecastEligibility {
  eligible: boolean;
  reason: string | null;
}

export interface PeriodComparison {
  current_period: string;
  previous_period: string;
  current_value: number;
  previous_value: number;
  delta_pct: number | null;
}

export interface TimeSeriesSpike {
  period: string;
  value: number;
  expected: number;
  deviation_std: number;
  direction: "above" | "below";
}

export interface Seasonality {
  detected: boolean;
  reason?: string;
  lag?: number;
  autocorrelation?: number;
  periods_available?: number;
  periods_required?: number;
}

export interface RiskAlert {
  metric: string;
  direction: "decline";
  confidence_pct: number | null;
  primary_driver: string | null;
  note: string;
}

export interface Anomaly {
  column: string;
  semantic_label: string;
  row: string;
  value: number;
  direction: "above" | "below";
  bounds: { lower: number; upper: number };
}

export interface DecisionAction {
  id: string;
  column: string;
  label: string;
  semantic_label: string;
  default_pct: number;
}

export interface InvalidValueIssue {
  column: string;
  semantic_label: string;
  issue: string;
  count: number;
  examples: string[];
}

export interface QualityRecommendation {
  column: string | null;
  severity: "high" | "medium" | "low";
  issue: string;
  recommendation: string;
}

export interface DataQualityReport {
  score: number;
  duplicate_row_count: number;
  duplicate_row_pct: number;
  invalid_values: InvalidValueIssue[];
  recommendations: QualityRecommendation[];
}

export interface NumericCorrelation {
  column_a: string;
  column_b: string;
  label_a: string;
  label_b: string;
  r: number;
  strength: "strong" | "moderate" | "weak";
  direction: "positive" | "negative";
}

export interface CategoricalAssociation {
  column_a: string;
  column_b: string;
  label_a: string;
  label_b: string;
  cramers_v: number;
  strength: "strong" | "moderate" | "weak";
}

export interface RootCauseDimension {
  dimension_column: string;
  dimension_label: string;
  variance_explained_pct: number;
  top_segment: string;
  top_segment_deviation_pct: number | null;
}

export interface RootCauseAnalysis {
  metric_column: string;
  metric_label: string;
  dimensions: RootCauseDimension[];
  note: string;
}

export interface AnalyzeResponse {
  analysis_id: string;
  filename: string;
  row_count: number;
  column_count: number;
  domain: string;
  schema: ColumnSchema[];
  charts: ChartSpec[];
  graph: KnowledgeGraph;
  quality: DataQualityReport;
  forecast: Forecast | null;
  forecast_eligibility: ForecastEligibility;
  anomalies: Anomaly[];
  time_series_spikes: TimeSeriesSpike[];
  seasonality: Seasonality;
  period_comparison: PeriodComparison | null;
  correlations: NumericCorrelation[];
  associations: CategoricalAssociation[];
  root_cause: RootCauseAnalysis | null;
  risk_alerts: RiskAlert[];
  decisions: DecisionAction[];
  primary_metric: string | null;
}

export interface AskResponse {
  intent: string;
  computed: Record<string, unknown>;
  answer: string;
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

export type Confidence = "high" | "medium" | "low";

export interface PropagatedEffect {
  column: string;
  semantic_label: string;
  baseline: number;
  projected: number;
  delta_pct: number | null;
  r_squared: number;
  confidence: Confidence;
  relationship: "direct change" | "positive association" | "negative association";
}

export interface SimulationResult {
  driver_column: string;
  driver_label: string;
  pct_change: number;
  effects: PropagatedEffect[];
  note: string;
}

export interface SimulationExplanation {
  summary: string;
  assumptions: string[];
}
