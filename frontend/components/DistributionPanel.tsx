import type { Distribution } from "@/lib/types";

const SHAPE_LABELS: Record<string, string> = {
  approximately_normal: "Approximately normal",
  right_skewed: "Right-skewed",
  left_skewed: "Left-skewed",
  heavy_tailed: "Heavy-tailed",
};

const SHAPE_COLORS: Record<string, string> = {
  approximately_normal: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  right_skewed: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  left_skewed: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  heavy_tailed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function DistributionPanel({ distributions }: { distributions: Record<string, Distribution> }) {
  const entries = Object.entries(distributions);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">Distributions</h3>
      <ul className="space-y-2">
        {entries.map(([col, d]) => (
          <li key={col} className="text-sm flex items-center justify-between gap-2">
            <span className="font-mono text-xs">{col}</span>
            <span className="text-xs text-slate-500">
              median={d.median}, skew={d.skewness}
            </span>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${SHAPE_COLORS[d.shape]}`}>
              {SHAPE_LABELS[d.shape]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
