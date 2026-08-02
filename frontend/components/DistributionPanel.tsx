"use client";

import type { Distribution } from "@/lib/types";
import { ExpandableDetail } from "./ExpandableDetail";
import { PALETTE } from "./charts";

const SHAPE_LABELS: Record<string, string> = {
  approximately_normal: "Approximately normal",
  right_skewed: "Right-skewed",
  left_skewed: "Left-skewed",
  heavy_tailed: "Heavy-tailed",
};

const SHAPE_COLORS: Record<string, string> = {
  approximately_normal: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  right_skewed: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  left_skewed: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  heavy_tailed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function DistributionPanel({ distributions }: { distributions: Record<string, Distribution> }) {
  const entries = Object.entries(distributions);
  if (entries.length === 0) return null;

  return (
    <div className="card p-4">
      <h3 className="text-base font-semibold text-foreground mb-3">Distributions</h3>
      <ul className="space-y-2">
        {entries.map(([col, d], i) => (
          <li key={col} className="group text-sm border-b border-border/60 last:border-0 pb-2 last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                {col}
              </span>
              <span className="text-xs text-muted flex items-center gap-1">
                median={d.median}, skew={d.skewness}
                <ExpandableDetail label="Show full stats">
                  mean={d.mean}, mode={d.mode ?? "—"}, variance={d.variance}, std={d.std}, excess kurtosis=
                  {d.excess_kurtosis} · percentiles: p10={d.percentiles.p10}, p25={d.percentiles.p25}, p50=
                  {d.percentiles.p50}, p75={d.percentiles.p75}, p90={d.percentiles.p90}
                </ExpandableDetail>
              </span>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${SHAPE_COLORS[d.shape]}`}>
                {SHAPE_LABELS[d.shape]}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
