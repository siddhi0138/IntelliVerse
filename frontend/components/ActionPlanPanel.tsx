"use client";

import { useState } from "react";
import { generateActionPlan } from "@/lib/api";
import type { ActionPlanResult, DataQualityReport, Forecast, RankedFinding, RiskAlert, RootCauseAnalysis } from "@/lib/types";

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

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const result = await generateActionPlan(analysisId, domain, rankedFindings, riskAlerts, rootCause, forecast, quality);
      setPlan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate an action plan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/20 p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Autonomous Action Plan</h3>
        <button
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-50"
        >
          {loading ? "Analyzing…" : plan ? "Regenerate" : "Generate Plan"}
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Chains everything already computed above (ranked findings, risk alerts, root cause, forecast, and a real
        decision-simulation preview) into a prioritized plan — every action is grounded in a specific computed
        signal, not free-form.
      </p>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

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
        </div>
      )}
    </div>
  );
}
