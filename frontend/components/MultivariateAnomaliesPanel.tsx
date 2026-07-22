import type { MultivariateAnomaly } from "@/lib/types";

const METHOD_LABELS: Record<string, string> = {
  isolation_forest: "Isolation Forest",
  local_outlier_factor: "Local Outlier Factor",
  one_class_svm: "One-Class SVM",
};

const CONSENSUS_COLORS: Record<number, string> = {
  1: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
  2: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  3: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function MultivariateAnomaliesPanel({ anomalies }: { anomalies: MultivariateAnomaly[] }) {
  if (anomalies.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Multivariate Anomalies</h3>
      <p className="text-xs text-slate-500 mb-3">
        Rows unusual across a combination of metrics — Isolation Forest, Local Outlier Factor, and One-Class SVM
        each vote; agreement across methods means higher confidence.
      </p>
      <ul className="space-y-3">
        {anomalies.map((a, i) => (
          <li key={i} className="text-sm border-b border-slate-100 dark:border-slate-600/60 last:border-0 pb-3 last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{a.row}</span>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${CONSENSUS_COLORS[a.consensus] ?? CONSENSUS_COLORS[1]}`}>
                {a.consensus} method{a.consensus > 1 ? "s" : ""} agree
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Detected by: {a.detected_by.map((m) => METHOD_LABELS[m] ?? m).join(", ")}
            </p>
            <p className="text-xs text-slate-500">
              {Object.entries(a.values)
                .map(([k, v]) => `${k}=${v}`)
                .join(", ")}
            </p>
            {a.top_contributing_features && (
              <p className="text-xs text-slate-500 mt-0.5">
                Top drivers (SHAP):{" "}
                {a.top_contributing_features
                  .map((f) => `${f.feature} (${f.impact > 0 ? "+" : ""}${f.impact})`)
                  .join(", ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
