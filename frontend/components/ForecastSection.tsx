"use client";

import { useEffect, useState } from "react";
import { explainForecast, forecastColumn } from "@/lib/api";
import type { Forecast, ForecastEligibility, ForecastableTarget } from "@/lib/types";
import { ForecastChart } from "@/components/ForecastChart";
import { ForecastTargetsPanel } from "@/components/ForecastTargetsPanel";
import { ForecastComparisonTable } from "@/components/ForecastComparisonTable";
import { ForecastExplanationPanel } from "@/components/ForecastExplanationPanel";

export function ForecastSection({
  analysisId,
  domain,
  initialForecast,
  eligibility,
  targets,
  primaryMetric,
}: {
  analysisId: string;
  domain: string;
  initialForecast: Forecast | null;
  eligibility: ForecastEligibility;
  targets: ForecastableTarget[];
  primaryMetric: string | null;
}) {
  const [selectedColumn, setSelectedColumn] = useState<string | null>(primaryMetric);
  const [forecast, setForecast] = useState<Forecast | null>(initialForecast);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [explanation, setExplanation] = useState<string | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  async function selectTarget(column: string) {
    setSelectedColumn(column);
    if (column === primaryMetric && initialForecast) {
      setForecast(initialForecast);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await forecastColumn(analysisId, column);
      setForecast(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not forecast this column.");
      setForecast(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!forecast || forecast.method === "insufficient_data" || forecast.forecast.length === 0) {
      return;
    }

    let cancelled = false;

    async function run() {
      if (!forecast) return;
      setExplanationLoading(true);
      setExplanationError(null);
      try {
        const summary = await explainForecast(domain, forecast);
        if (!cancelled) setExplanation(summary);
      } catch (err) {
        if (!cancelled) {
          setExplanationError(err instanceof Error ? err.message : "Could not explain the forecast.");
        }
      } finally {
        if (!cancelled) setExplanationLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [forecast, domain]);

  return (
    <div className="space-y-4">
      <ForecastTargetsPanel targets={targets} selectedColumn={selectedColumn} onSelect={selectTarget} />
      {loading && <p className="text-sm text-slate-500">Forecasting…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <ForecastChart forecast={forecast} eligibility={eligibility} />
      {forecast?.validation && <ForecastComparisonTable validation={forecast.validation} />}
      {forecast && forecast.forecast.length > 0 && (
        <ForecastExplanationPanel summary={explanation} loading={explanationLoading} error={explanationError} />
      )}
    </div>
  );
}
