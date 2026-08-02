"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Forecast, ForecastEligibility } from "@/lib/types";
import { forecastConfidence } from "@/lib/plainLanguage";
import { TOOLTIP_STYLE } from "./charts";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { ExpandableDetail } from "./ExpandableDetail";
import { Term } from "./Term";
import { useSimpleMode } from "./SimpleModeContext";

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
  random_forest: "Random Forest",
  xgboost: "XGBoost",
  lightgbm: "LightGBM",
  prophet: "Prophet",
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
  const { simpleMode } = useSimpleMode();
  if (!eligibility.eligible || !forecast || forecast.method === "insufficient_data" || forecast.forecast.length === 0) {
    return (
      <div className="card">
        <h3 className="text-base font-semibold text-foreground mb-2">Forecast</h3>
        <p className="text-sm text-muted">
          {eligibility.reason ?? "Not enough historical periods to project a trend yet."}
        </p>
      </div>
    );
  }

  const rows = buildRows(forecast);
  const modelLabel = MODEL_LABELS[forecast.method] ?? forecast.method;
  const mape = forecast.validation?.metrics.mape ?? null;
  const trendWord = forecast.trend === "up" ? "rising" : forecast.trend === "down" ? "falling" : "staying flat";

  return (
    <div className="group card">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-base font-semibold text-foreground">
          Forecast: {forecast.column ?? "primary metric"}
        </h3>
        <ConfidenceBadge level={forecastConfidence(mape)} />
      </div>
      {simpleMode ? (
        <div className="flex flex-wrap items-center gap-1 mb-3">
          <p className="text-xs text-muted">
            {forecast.column ?? "This metric"} looks to be {trendWord} over the next few periods. The shaded band
            shows the range of likely outcomes.
          </p>
          {forecast.validation && (
            <ExpandableDetail label="Show the technical detail">
              Method: {modelLabel}. Chosen by backtesting {forecast.validation.all_candidates.length} candidate model(s)
              over <Term id="holdout">{forecast.validation.holdout_periods} held-out period(s)</Term> —{" "}
              <Term id="mape">MAPE</Term> {mape !== null ? `${mape}%` : "n/a"}, <Term id="rmse">RMSE</Term>{" "}
              {forecast.validation.metrics.rmse}.
            </ExpandableDetail>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted mb-3">
          Trend: {forecast.trend} ({modelLabel}
          {forecast.validation && (
            <>
              , selected by backtesting {forecast.validation.all_candidates.length} candidate model(s) over{" "}
              <Term id="holdout">{forecast.validation.holdout_periods} held-out period(s)</Term>:{" "}
              <Term id="mape">MAPE</Term>={mape !== null ? `${mape}%` : "n/a"}, <Term id="rmse">RMSE</Term>=
              {forecast.validation.metrics.rmse}
            </>
          )}
          ). Shaded band = prediction interval.
        </p>
      )}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis dataKey="period" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="actual" name="Actual" stroke="#7dd3fc" strokeWidth={2} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#a78bfa" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
            <Line type="monotone" dataKey="upper" name="Upper bound" stroke="#a78bfa" strokeOpacity={0.4} strokeWidth={1} strokeDasharray="2 3" dot={false} connectNulls />
            <Line type="monotone" dataKey="lower" name="Lower bound" stroke="#a78bfa" strokeOpacity={0.4} strokeWidth={1} strokeDasharray="2 3" dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
