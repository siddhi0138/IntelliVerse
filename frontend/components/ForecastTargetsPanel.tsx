import type { ForecastableTarget } from "@/lib/types";

export function ForecastTargetsPanel({
  targets,
  selectedColumn,
  onSelect,
}: {
  targets: ForecastableTarget[];
  selectedColumn: string | null;
  onSelect: (column: string) => void;
}) {
  if (targets.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Forecastable Targets</h3>
      <div className="flex flex-wrap gap-2">
        {targets.map((t) => (
          <button
            key={t.column}
            onClick={() => t.eligible && onSelect(t.column)}
            disabled={!t.eligible}
            title={t.reason ?? undefined}
            className={`rounded-full border px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed ${
              selectedColumn === t.column
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                : "border-slate-300 dark:border-slate-700 hover:border-indigo-400"
            }`}
          >
            {t.semantic_label} ({Math.round(t.confidence * 100)}%)
          </button>
        ))}
      </div>
    </div>
  );
}
