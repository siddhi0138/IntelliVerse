"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeFile, fetchInsights } from "@/lib/api";
import type { AnalyzeResponse, Insight } from "@/lib/types";
import { ChartCard, KpiRow } from "@/components/charts";
import { SchemaTable } from "@/components/SchemaTable";
import { InsightsPanel } from "@/components/InsightsPanel";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";

export default function Home() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setInsights(null);
    setInsightsError(null);
    try {
      const data = await analyzeFile(file);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    setInsightsLoading(true);
    setInsightsError(null);
    fetchInsights(result.domain, result.row_count, result.schema)
      .then((data) => {
        if (!cancelled) setInsights(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setInsightsError(err instanceof Error ? err.message : "Could not generate insights.");
        }
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
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
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">NEXUS</h1>
        <p className="text-slate-500 mt-1">Upload anything. Understand everything.</p>
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
          {loading ? "Analyzing…" : "Drop a CSV, Excel, or JSON file here, or click to browse"}
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

          {result.charts
            .filter((c) => c.chart_type === "kpi")
            .map((chart) => (
              <KpiRow key={chart.id} chart={chart} />
            ))}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {result.charts
              .filter((c) => c.chart_type !== "kpi")
              .map((chart) => (
                <ChartCard key={chart.id} chart={chart} />
              ))}
            <InsightsPanel insights={insights} loading={insightsLoading} error={insightsError} />
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Knowledge graph</h3>
            <KnowledgeGraph graph={result.graph} />
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Detected schema</h3>
            <SchemaTable schema={result.schema} />
          </div>
        </div>
      )}
    </main>
  );
}
