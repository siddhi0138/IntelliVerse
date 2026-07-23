import type { ForecastValidation } from "@/lib/types";

const MODEL_LABELS: Record<string, string> = {
  naive: "Naive (carry-forward)",
  linear_trend: "Linear trend (OLS)",
  holt_linear_trend: "Holt's exponential smoothing",
  random_forest: "Random Forest",
  xgboost: "XGBoost",
  lightgbm: "LightGBM",
  prophet: "Prophet",
};

export function ForecastComparisonTable({ validation }: { validation: ForecastValidation }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
            <th className="px-4 py-2 font-medium">Model</th>
            <th className="px-4 py-2 font-medium text-right">MAPE</th>
            <th className="px-4 py-2 font-medium text-right">RMSE</th>
            <th className="px-4 py-2 font-medium text-right">R&sup2;</th>
            <th className="px-4 py-2 font-medium text-center">Selected</th>
          </tr>
        </thead>
        <tbody>
          {validation.all_candidates.map((c) => (
            <tr
              key={c.model}
              className={`border-b border-slate-100 dark:border-slate-800/60 last:border-0 ${
                c.selected ? "bg-indigo-50/60 dark:bg-indigo-900/20" : ""
              }`}
            >
              <td className="px-4 py-2">{MODEL_LABELS[c.model] ?? c.model}</td>
              <td className="px-4 py-2 text-right">{c.mape !== null ? `${c.mape}%` : "n/a"}</td>
              <td className="px-4 py-2 text-right">{c.rmse}</td>
              <td className="px-4 py-2 text-right">{c.r_squared ?? "n/a"}</td>
              <td className="px-4 py-2 text-center">{c.selected ? "✅" : "❌"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-2 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800/60">
        Backtested on {validation.holdout_periods} held-out period(s): {validation.validation_period.start} to{" "}
        {validation.validation_period.end}, trained on {validation.train_period.start} to{" "}
        {validation.train_period.end}.
      </p>
    </div>
  );
}
