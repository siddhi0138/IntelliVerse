import type { SimulationExplanation } from "@/lib/types";

export function SimulationExplanationPanel({
  explanation,
  loading,
  error,
}: {
  explanation: SimulationExplanation | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">AI Explanation</h3>

      {loading && <p className="text-sm text-slate-500">Explaining the projection…</p>}

      {error && !loading && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading && explanation && (
        <div className="space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-300">{explanation.summary}</p>
          {explanation.assumptions.length > 0 && (
            <ul className="list-disc list-inside text-xs text-slate-500 space-y-1">
              {explanation.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
