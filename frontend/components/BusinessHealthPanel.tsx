import type { BusinessHealth } from "@/lib/types";

const COMPONENT_LABELS: Record<keyof BusinessHealth["components"], string> = {
  data_quality: "Data Quality",
  growth: "Growth",
  forecast_reliability: "Forecast Confidence",
  safety: "Risk Safety",
};

function barColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 45) return "bg-amber-500";
  return "bg-red-500";
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 45) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function stars(score: number): string {
  const filled = Math.round(score / 20);
  return "★★★★★".slice(0, filled) + "☆☆☆☆☆".slice(filled);
}

export function BusinessHealthPanel({ health }: { health: BusinessHealth }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">🏆 Business Health</h3>
      <p className="text-xs text-slate-500 mb-4">
        One score summarizing data quality, growth, forecast confidence, and risk — built entirely from the
        numbers below, no AI involved.
      </p>

      <div className="flex items-center gap-4 mb-5">
        <span className={`text-5xl font-bold ${scoreColor(health.overall)}`}>{health.overall}</span>
        <div>
          <p className="text-sm text-slate-500">out of 100</p>
          <p className={`text-lg ${scoreColor(health.overall)}`}>{stars(health.overall)}</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {(Object.keys(health.components) as (keyof BusinessHealth["components"])[]).map((key) => {
          const value = health.components[key];
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-600 dark:text-slate-400">{COMPONENT_LABELS[key]}</span>
                <span className="font-medium">{value}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                <div className={`h-1.5 rounded-full ${barColor(value)}`} style={{ width: `${value}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
