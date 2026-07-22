import type { Insight } from "@/lib/types";

const CONFIDENCE_COLORS: Record<Insight["confidence"], string> = {
  high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
};

export function InsightsPanel({
  insights,
  loading,
  error,
}: {
  insights: Insight[] | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">AI Insights</h3>

      {loading && (
        <p className="text-sm text-slate-500">Asking the model to look for patterns…</p>
      )}

      {error && !loading && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!loading && !error && insights && insights.length === 0 && (
        <p className="text-sm text-slate-500">Not enough signal in this dataset for a confident insight.</p>
      )}

      {!loading && insights && insights.length > 0 && (
        <ul className="space-y-3">
          {insights.map((insight, i) => (
            <li key={i} className="border-b border-slate-100 dark:border-slate-600/60 last:border-0 pb-3 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{insight.title}</span>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${CONFIDENCE_COLORS[insight.confidence]}`}>
                  {insight.confidence}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{insight.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
