"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { analyzeFileWithProgress, fetchInsights } from "@/lib/api";
import type { AnalyzeResponse, Insight, Recommendation } from "@/lib/types";
import { ChartCard, KpiRow } from "@/components/charts";
import { SchemaTable } from "@/components/SchemaTable";
import { InsightsPanel } from "@/components/InsightsPanel";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { KnowledgeGraph3D } from "@/components/KnowledgeGraph3D";
import { ForecastSection } from "@/components/ForecastSection";
import { AnomaliesPanel } from "@/components/AnomaliesPanel";
import { RecommendationsPanel } from "@/components/RecommendationsPanel";
import { DecisionSimulator } from "@/components/DecisionSimulator";
import { DataQualityPanel } from "@/components/DataQualityPanel";
import { RelationshipsPanel } from "@/components/RelationshipsPanel";
import { RootCausePanel } from "@/components/RootCausePanel";
import { RiskAlertsPanel } from "@/components/RiskAlertsPanel";
import { AskIntelliVerse } from "@/components/AskIntelliVerse";
import { DatasetSummaryPanel } from "@/components/DatasetSummaryPanel";
import { RankedFindingsPanel } from "@/components/RankedFindingsPanel";
import { InsightTimelinePanel } from "@/components/InsightTimelinePanel";
import { MultivariateAnomaliesPanel } from "@/components/MultivariateAnomaliesPanel";
import { DistributionPanel } from "@/components/DistributionPanel";
import { ClusteringPanel } from "@/components/ClusteringPanel";
import { GEValidationPanel } from "@/components/GEValidationPanel";
import { ActionPlanPanel } from "@/components/ActionPlanPanel";
import { SqlQueryPanel } from "@/components/SqlQueryPanel";
import { ReportExportPanel } from "@/components/ReportExportPanel";

export default function Home() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [graphView, setGraphView] = useState<"2d" | "3d">("2d");

  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setProgressStep(null);
    setError(null);
    setResult(null);
    setInsights(null);
    setRecommendations(null);
    setInsightsError(null);
    try {
      const data = await analyzeFileWithProgress(file, setProgressStep);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
      setProgressStep(null);
    }
  }, []);

  useEffect(() => {
    if (!result) return;
    let cancelled = false;

    async function run() {
      if (!result) return;
      setInsightsLoading(true);
      setInsightsError(null);
      try {
        const data = await fetchInsights(
          result.domain,
          result.row_count,
          result.schema,
          result.anomalies,
          result.forecast,
          result.quality,
          result.root_cause,
          result.period_comparison
        );
        if (!cancelled) {
          setInsights(data.insights);
          setRecommendations(data.recommendations);
        }
      } catch (err) {
        if (!cancelled) {
          setInsightsError(err instanceof Error ? err.message : "Could not generate insights.");
        }
      } finally {
        if (!cancelled) setInsightsLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [result]);

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">IntelliVerse</h1>
          <p className="text-slate-500 mt-1">Upload anything. Understand everything.</p>
        </div>
        <div className="flex gap-4">
          <Link href="/workspace" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
            Multi-table workspace &rarr;
          </Link>
          <Link href="/catalog" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
            Dataset catalog &rarr;
          </Link>
        </div>
      </header>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
          dragActive
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
            : "border-slate-300 dark:border-slate-700 hover:border-indigo-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <p className="text-slate-600 dark:text-slate-400">
          {loading
            ? progressStep ?? "Analyzing…"
            : "Drop a CSV, Excel, or JSON file here, or click to browse"}
        </p>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {result && (
        <div className="mt-10 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-medium">{result.filename}</h2>
              <p className="text-sm text-slate-500">
                {result.row_count.toLocaleString()} rows &middot; {result.column_count} columns
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-sm font-medium">
              {result.domain}
            </span>
          </div>

          <ReportExportPanel key={`report-${result.analysis_id}`} analysisId={result.analysis_id} />

          <DatasetSummaryPanel
            domain={result.domain}
            rowCount={result.row_count}
            columnCount={result.column_count}
            schema={result.schema}
            quality={result.quality}
          />

          <RiskAlertsPanel alerts={result.risk_alerts} />

          {result.charts
            .filter((c) => c.chart_type === "kpi")
            .map((chart) => (
              <KpiRow key={chart.id} chart={chart} />
            ))}

          <AskIntelliVerse analysisId={result.analysis_id} domain={result.domain} primaryMetric={result.primary_metric} />

          <RankedFindingsPanel findings={result.ranked_findings} />

          <div>
            <h3 className="text-lg font-medium mb-1">Forecast</h3>
            <p className="text-sm text-slate-500 mb-3">
              Multiple models are backtested per target; the one with the lowest validation error is chosen
              automatically.
            </p>
            <ForecastSection
              analysisId={result.analysis_id}
              domain={result.domain}
              initialForecast={result.forecast}
              eligibility={result.forecast_eligibility}
              targets={result.forecastable_targets}
              primaryMetric={result.primary_metric}
            />
          </div>

          <ActionPlanPanel
            analysisId={result.analysis_id}
            domain={result.domain}
            rankedFindings={result.ranked_findings}
            riskAlerts={result.risk_alerts}
            rootCause={result.root_cause}
            forecast={result.forecast}
            quality={result.quality}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {result.charts
              .filter((c) => c.chart_type !== "kpi")
              .map((chart) => (
                <ChartCard key={chart.id} chart={chart} />
              ))}
            <InsightsPanel insights={insights} loading={insightsLoading} error={insightsError} />
            <AnomaliesPanel anomalies={result.anomalies} />
            <RecommendationsPanel recommendations={recommendations} loading={insightsLoading} />
            <DataQualityPanel quality={result.quality} />
            <RelationshipsPanel correlations={result.correlations} associations={result.associations} />
            <RootCausePanel rootCause={result.root_cause} />
            <DistributionPanel distributions={result.distributions} />
            <MultivariateAnomaliesPanel anomalies={result.multivariate_anomalies} />
            <ClusteringPanel clustering={result.clustering} />
            <GEValidationPanel validation={result.ge_validation} />
          </div>

          <InsightTimelinePanel timeline={result.insight_timeline} />

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Knowledge graph</h3>
              <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden text-xs">
                <button
                  onClick={() => setGraphView("2d")}
                  className={`px-3 py-1 ${graphView === "2d" ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-400"}`}
                >
                  2D
                </button>
                <button
                  onClick={() => setGraphView("3d")}
                  className={`px-3 py-1 ${graphView === "3d" ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-400"}`}
                >
                  3D
                </button>
              </div>
            </div>
            {graphView === "2d" ? <KnowledgeGraph graph={result.graph} /> : <KnowledgeGraph3D graph={result.graph} />}
          </div>

          <div>
            <h3 className="text-lg font-medium mb-1">Decision Simulator</h3>
            <p className="text-sm text-slate-500 mb-3">
              Choose a decision, and see its estimated effect on other metrics based on historical associations in
              this dataset.
            </p>
            <DecisionSimulator
              analysisId={result.analysis_id}
              domain={result.domain}
              decisions={result.decisions}
              primaryMetric={result.primary_metric}
            />
          </div>

          <SqlQueryPanel key={`sql-${result.analysis_id}`} analysisId={result.analysis_id} />

          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Detected schema</h3>
            <SchemaTable key={result.analysis_id} schema={result.schema} analysisId={result.analysis_id} />
          </div>
        </div>
      )}
    </main>
  );
}
