import type { Recommendation } from "@/lib/types";

export function RecommendationsPanel({
  recommendations,
  loading,
}: {
  recommendations: Recommendation[] | null;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Recommended actions</h3>

      {loading && <p className="text-sm text-slate-500">Working out what to do about it…</p>}

      {!loading && recommendations && recommendations.length === 0 && (
        <p className="text-sm text-slate-500">No specific actions recommended yet.</p>
      )}

      {!loading && recommendations && recommendations.length > 0 && (
        <ul className="space-y-3">
          {recommendations.map((rec, i) => (
            <li key={i} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0 pb-3 last:pb-0">
              <p className="font-medium text-sm">{rec.title}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{rec.action}</p>
              <p className="text-xs text-slate-500 mt-1 italic">{rec.rationale}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
