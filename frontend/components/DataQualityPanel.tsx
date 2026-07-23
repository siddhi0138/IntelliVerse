import type { DataQualityReport } from "@/lib/types";

const SEVERITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400",
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function DataQualityPanel({ quality }: { quality: DataQualityReport }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Data Quality</h3>
        <span className={`text-2xl font-semibold ${scoreColor(quality.score)}`}>{quality.score}</span>
      </div>

      <div className="text-sm text-slate-500 mb-3">
        {quality.duplicate_row_count > 0
          ? `${quality.duplicate_row_count} duplicate row(s) (${quality.duplicate_row_pct}%)`
          : "No duplicate rows detected."}
      </div>

      {quality.recommendations.length === 0 ? (
        <p className="text-sm text-slate-500">No data quality issues detected.</p>
      ) : (
        <ul className="space-y-2">
          {quality.recommendations.map((rec, i) => (
            <li key={i} className="text-sm border-b border-slate-100 dark:border-slate-800/60 last:border-0 pb-2 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span>{rec.issue}</span>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[rec.severity]}`}>
                  {rec.severity}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">→ {rec.recommendation}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
