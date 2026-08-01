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
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-base font-semibold text-foreground mb-3">AI Explanation</h3>

      {loading && <p className="text-sm text-muted">Explaining the projection…</p>}

      {error && !loading && (
        <p className="text-sm text-red-600 dark:text-red-400" title={error}>
          AI explanation isn&apos;t available right now — the simulated numbers above aren&apos;t affected.
        </p>
      )}

      {!loading && explanation && (
        <div className="space-y-3">
          <p className="text-sm text-foreground">{explanation.summary}</p>
          {explanation.assumptions.length > 0 && (
            <ul className="list-disc list-inside text-xs text-muted space-y-1">
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
