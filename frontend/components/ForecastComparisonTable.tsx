import type { ForecastValidation } from "@/lib/types";
import { Term } from "./Term";

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
    <div className="card p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-4 py-2 font-medium">Model</th>
            <th className="px-4 py-2 font-medium text-right">
              <Term id="mape">MAPE</Term>
            </th>
            <th className="px-4 py-2 font-medium text-right">
              <Term id="rmse">RMSE</Term>
            </th>
            <th className="px-4 py-2 font-medium text-right">
              <Term id="r_squared">R&sup2;</Term>
            </th>
            <th className="px-4 py-2 font-medium text-center">Selected</th>
          </tr>
        </thead>
        <tbody>
          {validation.all_candidates.map((c) => (
            <tr
              key={c.model}
              className={`border-b border-border/60 last:border-0 ${
                c.selected ? "bg-primary/5" : ""
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
      <p className="px-4 py-2 text-xs text-muted border-t border-border/60">
        <Term id="holdout">Backtested</Term> on {validation.holdout_periods} held-out period(s):{" "}
        {validation.validation_period.start} to {validation.validation_period.end}, trained on{" "}
        {validation.train_period.start} to {validation.train_period.end}.
      </p>
    </div>
  );
}
