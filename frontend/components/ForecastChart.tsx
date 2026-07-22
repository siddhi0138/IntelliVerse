"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Forecast, ForecastEligibility } from "@/lib/types";

interface Row {
  period: string;
  actual: number | null;
  forecast: number | null;
  upper: number | null;
  lower: number | null;
}

const MODEL_LABELS: Record<string, string> = {
  naive: "Naive (carry-forward)",
  linear_trend: "Linear trend (OLS)",
  holt_linear_trend: "Holt's linear exponential smoothing",
};

function buildRows(forecast: Forecast): Row[] {
  const rows: Row[] = forecast.history.map((p) => ({
    period: p.period,
    actual: p.value,
    forecast: null,
    upper: null,
    lower: null,
  }));

  const last = forecast.history[forecast.history.length - 1];
  if (last && rows.length > 0) {
    rows[rows.length - 1] = { ...rows[rows.length - 1], forecast: last.value, upper: last.value, lower: last.value };
  }

  for (const p of forecast.forecast) {
    rows.push({ period: p.period, actual: null, forecast: p.value, upper: p.upper, lower: p.lower });
  }

  return rows;
}

export function ForecastChart({
  forecast,
  eligibility,
}: {
  forecast: Forecast | null;
  eligibility: ForecastEligibility;
}) {
  if (!eligibility.eligible || !forecast || forecast.method === "insufficient_data" || forecast.forecast.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Forecast</h3>
        <p className="text-sm text-slate-500">
          {eligibility.reason ?? "Not enough historical periods to project a trend yet."}
        </p>
      </div>
    );
  }

  const rows = buildRows(forecast);
  const modelLabel = MODEL_LABELS[forecast.method] ?? forecast.method;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        Forecast: {forecast.column ?? "primary metric"}
      </h3>
      <p className="text-xs text-slate-500 mb-1">
        {modelLabel}, trending {forecast.trend ?? "flat"}. Shaded lines mark the uncertainty range.
      </p>
      {forecast.validation && (
        <p className="text-xs text-slate-500 mb-3">
          Chosen by backtest against {forecast.validation.all_candidates.length} candidate model(s) over{" "}
          {forecast.validation.holdout_periods} held-out period(s) — MAPE{" "}
          {forecast.validation.metrics.mape !== null ? `${forecast.validation.metrics.mape}%` : "n/a"}, RMSE{" "}
          {forecast.validation.metrics.rmse}.
        </p>
      )}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis dataKey="period" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="actual" name="Actual" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#6366f1" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
            <Line type="monotone" dataKey="upper" name="Upper bound" stroke="#a5b4fc" strokeWidth={1} strokeDasharray="2 3" dot={false} connectNulls />
            <Line type="monotone" dataKey="lower" name="Lower bound" stroke="#a5b4fc" strokeWidth={1} strokeDasharray="2 3" dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
