"use client";

import { useCallback, useEffect, useState } from "react";
import { explainSimulation, listSavedSimulations, runSimulation, saveSimulation } from "@/lib/api";
import type { DecisionAction, SavedSimulation, SimulationExplanation, SimulationResult } from "@/lib/types";
import { DecisionGraph } from "@/components/DecisionGraph";
import { EffectsList } from "@/components/EffectsList";
import { SimulationExplanationPanel } from "@/components/SimulationExplanationPanel";
import { ScenarioComparisonTable } from "@/components/ScenarioComparisonTable";

const SCENARIO_PRESETS = [
  { name: "Conservative Growth", pct: 8, risk: "Low" },
  { name: "Optimistic", pct: 18, risk: "Medium" },
  { name: "Aggressive Expansion", pct: 30, risk: "High" },
  { name: "Economic Downturn", pct: -20, risk: "High" },
] as const;

export function DecisionSimulator({
  analysisId,
  domain,
  decisions,
  primaryMetric,
}: {
  analysisId: string;
  domain: string;
  decisions: DecisionAction[];
  primaryMetric: string | null;
}) {
  const [selectedColumn, setSelectedColumn] = useState(primaryMetric ?? decisions[0]?.column ?? "");
  const [pct, setPct] = useState(20);

  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const [explanation, setExplanation] = useState<SimulationExplanation | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  const [comparison, setComparison] = useState<{ name: string; result: SimulationResult }[] | null>(null);
  const [comparing, setComparing] = useState(false);

  const [saved, setSaved] = useState<SavedSimulation[]>([]);
  const [saving, setSaving] = useState(false);

  const refreshSaved = useCallback(() => {
    listSavedSimulations(analysisId)
      .then(setSaved)
      .catch(() => {});
  }, [analysisId]);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  async function handleSave() {
    if (!result) return;
    const label = window.prompt("Label this saved simulation:", selectedColumn);
    if (!label) return;
    setSaving(true);
    try {
      await saveSimulation(analysisId, label, result);
      refreshSaved();
    } finally {
      setSaving(false);
    }
  }

  async function runOne(column: string, pctChange: number) {
    setRunning(true);
    setRunError(null);
    setComparison(null);
    setExplanation(null);
    setExplanationError(null);
    try {
      const r = await runSimulation(analysisId, column, pctChange);
      setResult(r);
      setExplanationLoading(true);
      explainSimulation(domain, r)
        .then(setExplanation)
        .catch((err) => setExplanationError(err instanceof Error ? err.message : "Could not explain this scenario."))
        .finally(() => setExplanationLoading(false));
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Simulation failed.");
    } finally {
      setRunning(false);
    }
  }

  async function runComparison() {
    if (!primaryMetric) return;
    setComparing(true);
    setResult(null);
    try {
      const entries = await Promise.all(
        SCENARIO_PRESETS.map(async (p) => ({
          name: `${p.name} (${p.pct > 0 ? "+" : ""}${p.pct}%)`,
          result: await runSimulation(analysisId, primaryMetric, p.pct),
        }))
      );
      setComparison(entries);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Comparison failed.");
    } finally {
      setComparing(false);
    }
  }

  if (decisions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Decision Simulator</h3>
        <p className="text-sm text-slate-500">No numeric columns detected to simulate against.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Custom decision</h3>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedColumn}
            onChange={(e) => setSelectedColumn(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm"
          >
            {decisions.map((d) => (
              <option
                key={d.id}
                value={d.column}
                className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                {d.label}
              </option>
            ))}
          </select>
          <input
            type="range"
            min={-50}
            max={50}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="w-40"
          />
          <span className="text-sm font-medium w-14">
            {pct > 0 ? "+" : ""}
            {pct}%
          </span>
          <button
            onClick={() => runOne(selectedColumn, pct)}
            disabled={running}
            className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-50"
          >
            {running ? "Running…" : "Run simulation"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Scenario presets</h3>
        <div className="flex flex-wrap gap-2">
          {SCENARIO_PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => primaryMetric && runOne(primaryMetric, p.pct)}
              disabled={!primaryMetric || running}
              className="rounded-full border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm hover:border-indigo-400 disabled:opacity-50"
            >
              {p.name} ({p.pct > 0 ? "+" : ""}
              {p.pct}%)
            </button>
          ))}
          <button
            onClick={runComparison}
            disabled={!primaryMetric || comparing}
            className="rounded-full bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {comparing ? "Comparing…" : "Compare all scenarios"}
          </button>
        </div>
      </div>

      {runError && <p className="text-sm text-red-600 dark:text-red-400">{runError}</p>}

      {result && (
        <div className="space-y-6">
          <DecisionGraph result={result} />
          <EffectsList result={result} />
          <SimulationExplanationPanel explanation={explanation} loading={explanationLoading} error={explanationError} />
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium px-4 py-1.5 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save this simulation"}
          </button>
        </div>
      )}

      {saved.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Saved simulations</h4>
          <ul className="space-y-1">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span>
                  {s.label} <span className="text-slate-500 text-xs">({new Date(s.saved_at).toLocaleString()})</span>
                </span>
                <button
                  onClick={() => setResult(s.simulation)}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs"
                >
                  Load
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {comparison && <ScenarioComparisonTable scenarios={comparison} />}
    </div>
  );
}
