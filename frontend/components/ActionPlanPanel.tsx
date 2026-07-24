"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteSavedActionPlan, generateActionPlan, listSavedActionPlans, saveActionPlan } from "@/lib/api";
import { usePersona } from "./PersonaContext";
import type {
  ActionPlanResult,
  DataQualityReport,
  Forecast,
  RankedFinding,
  RiskAlert,
  RootCauseAnalysis,
  SavedActionPlan,
} from "@/lib/types";

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400",
};

export function ActionPlanPanel({
  analysisId,
  domain,
  rankedFindings,
  riskAlerts,
  rootCause,
  forecast,
  quality,
}: {
  analysisId: string;
  domain: string;
  rankedFindings: RankedFinding[];
  riskAlerts: RiskAlert[];
  rootCause: RootCauseAnalysis | null;
  forecast: Forecast | null;
  quality: DataQualityReport | null;
}) {
  const [plan, setPlan] = useState<ActionPlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [saved, setSaved] = useState<SavedActionPlan[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { persona } = usePersona();

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const result = await generateActionPlan(
        analysisId,
        domain,
        rankedFindings,
        riskAlerts,
        rootCause,
        forecast,
        quality,
        persona
      );
      setPlan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate an action plan.");
    } finally {
      setLoading(false);
    }
  }

  const refreshSaved = useCallback(() => {
    listSavedActionPlans(analysisId)
      .then(setSaved)
      .catch(() => {});
  }, [analysisId]);

  useEffect(() => {
    // Auto-generate once on mount — the parent remounts this component per dataset
    // (keyed on analysisId), and "Regenerate" re-runs the same function on demand.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    run();
    refreshSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    if (!plan) return;
    const label = window.prompt("Label this saved plan:", new Date().toLocaleDateString());
    if (!label) return;
    setSaving(true);
    try {
      await saveActionPlan(analysisId, label, plan, persona);
      refreshSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(savedId: string) {
    if (!window.confirm("Delete this saved plan? This can't be undone.")) return;
    setDeletingId(savedId);
    try {
      await deleteSavedActionPlan(analysisId, savedId);
      refreshSaved();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/20 p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Autonomous Action Plan</h3>
        <button onClick={run} disabled={loading} className="btn-primary">
          {loading ? "Analyzing…" : plan ? "Regenerate" : "Generate Plan"}
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        What to do next, based on everything already found above — every action is grounded in a specific signal
        from your data, not free-form.
      </p>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" title={error}>
          AI-generated action plan isn&apos;t available right now — the findings and risk alerts elsewhere on this
          page aren&apos;t affected.
        </p>
      )}

      {plan && (
        <div className="space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-300">{plan.summary}</p>

          <ol className="space-y-2">
            {plan.actions.map((a) => (
              <li key={a.priority} className="text-sm border-b border-indigo-100 dark:border-indigo-800/50 last:border-0 pb-2 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">
                    {a.priority}. {a.action}
                  </span>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${CONFIDENCE_COLORS[a.confidence]}`}>
                    {a.confidence}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{a.rationale}</p>
                <p className="text-xs text-slate-500 italic">Grounded in: {a.grounded_in}</p>
              </li>
            ))}
          </ol>

          {plan.simulation_preview && (
            <div>
              <button
                onClick={() => setShowPreview((s) => !s)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {showPreview ? "Hide" : "Show"} underlying simulation preview
              </button>
              {showPreview && (
                <pre className="mt-2 text-xs bg-white dark:bg-slate-900 rounded-lg p-3 overflow-x-auto text-slate-600 dark:text-slate-400">
                  {JSON.stringify(plan.simulation_preview, null, 2)}
                </pre>
              )}
            </div>
          )}

          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save this plan"}
          </button>
        </div>
      )}

      {saved.length > 0 && (
        <div className="mt-4 pt-3 border-t border-indigo-100 dark:border-indigo-800/50">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Saved plans</h4>
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
                    onClick={() => setPlan(s.plan)}
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
