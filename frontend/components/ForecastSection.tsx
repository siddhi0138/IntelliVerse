"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteSavedForecast, explainForecast, forecastColumn, listSavedForecasts, saveForecast } from "@/lib/api";
import type { Forecast, ForecastEligibility, ForecastableTarget, SavedForecast } from "@/lib/types";
import { ForecastChart } from "@/components/ForecastChart";
import { ForecastTargetsPanel } from "@/components/ForecastTargetsPanel";
import { ForecastComparisonTable } from "@/components/ForecastComparisonTable";
import { ForecastExplanationPanel } from "@/components/ForecastExplanationPanel";
import { ExpandableDetail } from "@/components/ExpandableDetail";
import { usePersona } from "@/components/PersonaContext";

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

  const { persona } = usePersona();

  const [saved, setSaved] = useState<SavedForecast[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      await saveForecast(analysisId, label, forecast, persona);
      refreshSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(savedId: string) {
    if (!window.confirm("Delete this saved forecast? This can't be undone.")) return;
    setDeletingId(savedId);
    try {
      await deleteSavedForecast(analysisId, savedId);
      refreshSaved();
    } finally {
      setDeletingId(null);
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
        const summary = await explainForecast(domain, forecast, persona);
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
  }, [forecast, domain, persona]);

  return (
    <div className="space-y-4">
      <ForecastTargetsPanel targets={targets} selectedColumn={selectedColumn} onSelect={selectTarget} />
      {loading && <p className="text-sm text-slate-500">Forecasting…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <ForecastChart forecast={forecast} eligibility={eligibility} />
      {forecast?.validation && (
        <ExpandableDetail label="Show model comparison (for analysts)">
          <ForecastComparisonTable validation={forecast.validation} />
        </ExpandableDetail>
      )}
      {forecast && forecast.forecast.length > 0 && (
        <ForecastExplanationPanel summary={explanation} loading={explanationLoading} error={explanationError} />
      )}

      {forecast && forecast.forecast.length > 0 && (
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? "Saving…" : "Save this forecast"}
        </button>
      )}

      {saved.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h4 className="text-base font-semibold text-slate-900 dark:text-white mb-2">Saved forecasts</h4>
          <ul className="space-y-1">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span>
                  {s.label}{" "}
                  <span className="text-slate-500 text-xs">
                    ({new Date(s.saved_at).toLocaleString()}{s.persona ? ` · viewed as ${s.persona}` : ""})
                  </span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => setForecast(s.forecast)}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={deletingId === s.id}
                    className="btn-danger-ghost disabled:opacity-50"
                  >
                    {deletingId === s.id ? "Deleting…" : "Delete"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
