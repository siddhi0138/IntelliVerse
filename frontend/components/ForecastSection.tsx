"use client";

import { useCallback, useEffect, useState } from "react";
import { explainForecast, forecastColumn, listSavedForecasts, saveForecast } from "@/lib/api";
import type { Forecast, ForecastEligibility, ForecastableTarget, SavedForecast } from "@/lib/types";
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

  const [saved, setSaved] = useState<SavedForecast[]>([]);
  const [saving, setSaving] = useState(false);

  const refreshSaved = useCallback(() => {
    listSavedForecasts(analysisId)
      .then(setSaved)
      .catch(() => {});
  }, [analysisId]);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  async function handleSave() {
    if (!forecast || !selectedColumn) return;
    const label = window.prompt("Label this saved forecast:", selectedColumn);
    if (!label) return;
    setSaving(true);
    try {
      await saveForecast(analysisId, label, forecast);
      refreshSaved();
    } finally {
      setSaving(false);
    }
  }

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

      {forecast && forecast.forecast.length > 0 && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium px-4 py-1.5 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save this forecast"}
        </button>
      )}

      {saved.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Saved forecasts</h4>
          <ul className="space-y-1">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span>
                  {s.label} <span className="text-slate-500 text-xs">({new Date(s.saved_at).toLocaleString()})</span>
                </span>
                <button
                  onClick={() => setForecast(s.forecast)}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs"
                >
                  Load
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
