import type { Anomaly } from "@/lib/types";

export function AnomaliesPanel({ anomalies }: { anomalies: Anomaly[] }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">Anomalies</h3>

      {anomalies.length === 0 ? (
        <p className="text-sm text-slate-500">No statistical outliers detected.</p>
      ) : (
        <ul className="space-y-2">
          {anomalies.map((a, i) => (
            <li key={i} className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-medium">{a.semantic_label}</span>
                <span className="text-slate-500"> &middot; {a.row}</span>
              </span>
              <span
                className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                  a.direction === "above"
                    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                }`}
              >
                {a.value.toLocaleString()} ({a.direction} range)
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
