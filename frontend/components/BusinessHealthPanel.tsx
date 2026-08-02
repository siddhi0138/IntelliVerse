import type { BusinessHealth } from "@/lib/types";
import { Panel, ProgressBar } from "@/components/ui";

const COMPONENT_LABELS: Record<keyof BusinessHealth["components"], string> = {
  data_quality: "Data Quality",
  growth: "Growth",
  forecast_reliability: "Forecast Confidence",
  safety: "Risk Safety",
};

function tone(score: number): "good" | "warn" | "bad" {
  if (score >= 70) return "good";
  if (score >= 45) return "warn";
  return "bad";
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-accent";
  if (score >= 45) return "text-amber-400";
  return "text-red-400";
}

function barColor(t: "good" | "warn" | "bad"): string {
  return t === "good" ? "bg-accent" : t === "warn" ? "bg-amber-500" : "bg-red-500";
}

function stars(score: number): string {
  const filled = Math.round(score / 20);
  return "★★★★★".slice(0, filled) + "☆☆☆☆☆".slice(filled);
}

export function BusinessHealthPanel({ health }: { health: BusinessHealth }) {
  return (
    <Panel title="Business health" subtitle="Auto-computed composite scores">
      <div className="mb-5 flex items-center gap-3">
        <span className={`font-display text-4xl font-bold ${scoreColor(health.overall)}`}>{health.overall}</span>
        <div>
          <p className="text-sm text-muted">out of 100</p>
          <p className={`text-sm leading-none ${scoreColor(health.overall)}`}>{stars(health.overall)}</p>
        </div>
      </div>
      <div className="space-y-4">
        {(Object.keys(health.components) as (keyof BusinessHealth["components"])[]).map((key) => {
          const value = health.components[key];
          const t = tone(value);
          return (
            <div key={key}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/80">{COMPONENT_LABELS[key]}</span>
                <span className={`text-xs font-semibold ${scoreColor(value)}`}>{value}</span>
              </div>
              <ProgressBar value={value} className="mt-1.5" color={barColor(t)} />
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
