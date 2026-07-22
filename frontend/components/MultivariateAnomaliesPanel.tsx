import type { MultivariateAnomaly } from "@/lib/types";

export function MultivariateAnomaliesPanel({ anomalies }: { anomalies: MultivariateAnomaly[] }) {
  if (anomalies.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Multivariate Anomalies</h3>
      <p className="text-xs text-slate-500 mb-3">
        Rows unusual across a combination of metrics (Isolation Forest) — not just outliers in a single column.
      </p>
      <ul className="space-y-2">
        {anomalies.map((a, i) => (
          <li key={i} className="text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{a.row}</span>
              <span className="text-xs text-slate-500">score={a.anomaly_score}</span>
            </div>
            <p className="text-xs text-slate-500">
              {Object.entries(a.values)
                .map(([k, v]) => `${k}=${v}`)
                .join(", ")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
