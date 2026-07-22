export type ColumnType = "id" | "numeric" | "boolean" | "date" | "categorical" | "text";

export interface ColumnSchema {
  name: string;
  type: ColumnType;
  semantic_label: string;
  confidence: number;
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

export interface ForecastMetrics {
  rmse: number;
  mae: number;
  mape: number | null;
  r_squared: number | null;
}

export interface ForecastCandidate extends ForecastMetrics {
  model: string;
  selected: boolean;
}

export interface ForecastValidation {
  holdout_periods: number;
  chosen_model: string;
  metrics: ForecastMetrics;
  all_candidates: ForecastCandidate[];
  train_period: { start: string; end: string };
  validation_period: { start: string; end: string };
}

export type ForecastMethod =
  | "linear_trend"
  | "naive"
  | "holt_linear_trend"
  | "random_forest"
  | "xgboost"
  | "lightgbm"
  | "prophet"
  | "insufficient_data";

export interface Forecast {
  history: { period: string; value: number }[];
  forecast: ForecastPoint[];
  method: ForecastMethod;
  trend?: "up" | "down" | "flat";
  column?: string;
  validation?: ForecastValidation | null;
}

export interface ForecastEligibility {
  eligible: boolean;
  reason: string | null;
}

export interface ForecastableTarget {
  column: string;
  semantic_label: string;
  eligible: boolean;
  confidence: number;
  periods_available: number;
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
  kind: "decline" | "threshold_crossing";
  metric: string;
  direction: "decline" | "critical_level";
  confidence_pct: number | null;
  primary_driver: string | null;
  periods_until_critical?: number;
  note: string;
}

export interface Anomaly {
  column: string;
  semantic_label: string;
  row: string;
  value: number;
  direction: "above" | "below";
  method: "iqr" | "zscore";
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
  p_value: number;
  method: "pearson" | "spearman";
  significant: boolean;
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
  test_used: "anova" | "kruskal_wallis";
  test_statistic: number;
  p_value: number;
  significant: boolean;
}

export interface RootCauseAnalysis {
  metric_column: string;
  metric_label: string;
  dimensions: RootCauseDimension[];
  note: string;
}

export interface Distribution {
  mean: number;
  median: number;
  mode: number | null;
  variance: number;
  std: number;
  skewness: number;
  excess_kurtosis: number;
  percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number };
  shape: "approximately_normal" | "right_skewed" | "left_skewed" | "heavy_tailed";
}

export interface RankedFinding {
  kind: "correlation" | "association" | "root_cause" | "anomaly";
  headline: string;
  score: number;
  evidence: Record<string, unknown>;
}

export interface InsightTimelineEntry {
  period: string;
  value: number;
  notes: string[];
}

export interface FeatureImpact {
  feature: string;
  impact: number;
}

export interface MultivariateAnomaly {
  row: string;
  anomaly_score: number;
  values: Record<string, number>;
  method: string;
  detected_by: string[];
  consensus: number;
  top_contributing_features: FeatureImpact[] | null;
}

export interface ClusterProfile {
  cluster_id: number;
  size: number;
  profile: Record<string, number>;
  sample_ids: string[];
}

export interface ClusteringResult {
  k: number;
  silhouette_score: number;
  clusters: ClusterProfile[];
}

export interface GEValidationFailure {
  expectation: string;
  column: string | null;
  unexpected_count: number | null;
  unexpected_percent: number | null;
}

export interface GEValidation {
  available: boolean;
  reason?: string;
  success?: boolean;
  expectations_run?: number;
  failed?: GEValidationFailure[];
}

export interface AnalyzeResponse {
  analysis_id: string;
  filename: string;
  row_count: number;
  column_count: number;
  memory_usage_bytes: number;
  domain: string;
  schema: ColumnSchema[];
  charts: ChartSpec[];
  graph: KnowledgeGraph;
  quality: DataQualityReport;
  forecast: Forecast | null;
  forecast_eligibility: ForecastEligibility;
  forecastable_targets: ForecastableTarget[];
  anomalies: Anomaly[];
  multivariate_anomalies: MultivariateAnomaly[];
  time_series_spikes: TimeSeriesSpike[];
  seasonality: Seasonality;
  period_comparison: PeriodComparison | null;
  correlations: NumericCorrelation[];
  associations: CategoricalAssociation[];
  root_cause: RootCauseAnalysis | null;
  distributions: Record<string, Distribution>;
  ranked_findings: RankedFinding[];
  insight_timeline: InsightTimelineEntry[];
  risk_alerts: RiskAlert[];
  clustering: ClusteringResult | null;
  ge_validation: GEValidation;
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

export interface CatalogEntry {
  analysis_id: string;
  filename: string;
  uploaded_at: string;
  row_count: number;
  column_count: number;
  domain: string;
  quality_score: number;
}

// --- V5: multi-table workspaces --------------------------------------------

export interface WorkspaceTable {
  table: string;
  filename: string;
  row_count: number;
  column_count: number;
  schema: ColumnSchema[];
}

export interface RelationshipCandidate {
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
  confidence: number;
  overlap_pct: number;
  to_column_is_unique: boolean;
  relationship_type: "many_to_one" | "many_to_many";
  evidence: string;
}

export interface WorkspaceResponse {
  workspace_id: string;
  tables: WorkspaceTable[];
  suggested_relationships: RelationshipCandidate[];
}

export interface GraphAnalyticsEntry {
  node: string;
  table: string | null;
  key: string | null;
  score: number;
}

export interface GraphAnalytics {
  top_pagerank: GraphAnalyticsEntry[];
  top_degree_centrality: GraphAnalyticsEntry[];
  connected_components: number;
  component_sizes: number[];
}

export interface ConfirmRelationshipsResponse {
  node_count: number;
  edge_count: number;
  analytics: GraphAnalytics;
}

export interface WorkspaceGraphNode {
  id: string;
  table: string;
  key: string;
  degree: number;
}

export interface WorkspaceGraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface WorkspaceGraph {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  total_nodes: number;
  total_edges: number;
}

export interface EntityNeighbor {
  table: string;
  key: string;
  relationship: string;
  direction: "incoming" | "outgoing";
}

export interface EntityProfile {
  table: string;
  key: string;
  properties: Record<string, unknown>;
  neighbors: EntityNeighbor[];
}

// --- V6: graph-based impact propagation (digital twin) ---------------------

export interface EntityImpactEffect {
  node: string;
  table: string;
  key: string;
  hops: 1 | 2;
  contribution_share: number;
  estimated_delta_pct: number;
}

export interface EntityImpactResult {
  source: string;
  pct_change: number;
  affected_entities: EntityImpactEffect[];
  note: string;
}

// --- V7 (lean): autonomous action plan --------------------------------------

export interface ActionPlanAction {
  priority: number;
  action: string;
  rationale: string;
  grounded_in: string;
  confidence: "high" | "medium" | "low";
}

export interface ActionPlanResult {
  summary: string;
  actions: ActionPlanAction[];
  simulation_preview: SimulationResult | null;
}
