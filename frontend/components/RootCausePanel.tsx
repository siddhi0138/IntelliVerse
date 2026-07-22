import type { RootCauseAnalysis } from "@/lib/types";

export function RootCausePanel({ rootCause }: { rootCause: RootCauseAnalysis | null }) {
  if (!rootCause || rootCause.dimensions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Root Cause Breakdown</h3>
        <p className="text-sm text-slate-500">No categorical dimension explains enough variance to report.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        What explains changes in {rootCause.metric_label}?
      </h3>
      <p className="text-xs text-slate-500 mb-3">{rootCause.note}</p>
      <ul className="space-y-3">
        {rootCause.dimensions.map((d) => (
          <li key={d.dimension_column}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium">{d.dimension_label}</span>
              <span className="text-slate-500">{d.variance_explained_pct}% of variance</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-2 rounded-full bg-indigo-500"
                style={{ width: `${Math.min(d.variance_explained_pct, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Top segment: <span className="font-medium">{d.top_segment}</span>
              {d.top_segment_deviation_pct !== null && (
                <>
                  {" "}
                  ({d.top_segment_deviation_pct > 0 ? "+" : ""}
                  {d.top_segment_deviation_pct}% vs. average)
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
