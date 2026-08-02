"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartSpec } from "@/lib/types";

const AXIS_COLOR = "#64748b";
const GRID_COLOR = "#e2e8f0";

// Recharts' default tooltip box is a light/white card — its text otherwise
// inherits the page's near-white --foreground, which reads as invisible
// white-on-white. Force dark text (and pin the box itself light) so it's
// always legible regardless of the page's own color scheme.
export const TOOLTIP_STYLE = {
  contentStyle: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, color: "#0f172a" },
  labelStyle: { color: "#0f172a", fontWeight: 600 },
  itemStyle: { color: "#0f172a" },
} as const;

// Teal/violet (brand) plus amber/rose/emerald so a page with several charts
// and KPIs doesn't read as one flat color — cycled by index/title hash
// rather than tied to meaning (there's no fixed metric-to-color mapping).
// Exported so other panels (StatCard rows, progress bars) can pick up the
// same variety instead of everything defaulting to plain --primary cyan.
export const PALETTE = ["#5eead4", "#a78bfa", "#fbbf24", "#fb7185", "#34d399"];

function colorFromString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function KpiRow({ chart }: { chart: ChartSpec }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {chart.data.map((item, i) => {
        const color = PALETTE[i % PALETTE.length];
        return (
          <div key={i} className="card relative overflow-hidden pl-5">
            <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: color }} />
            <div className="text-xs uppercase tracking-wide text-muted">
              {String(item.label)}
            </div>
            <div className="text-2xl font-semibold mt-1" style={{ color }}>
              {typeof item.value === "number" ? item.value.toLocaleString() : String(item.value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// The chart + its "how to read this" caption, with no outer card — so it can
// be dropped straight into a <Panel> body (Overview's main trend chart) as
// well as into the standalone <ChartCard> below (Statistics tab grid).
export function ChartBody({ chart }: { chart: ChartSpec }) {
  const color = colorFromString(chart.title);
  return (
    <>
      <p className="text-xs text-muted mb-3">
        {chart.chart_type === "line"
          ? "How to read this: follow the line left to right to see the trend over time."
          : "How to read this: taller bars mean a bigger number for that category."}
      </p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {chart.chart_type === "line" ? (
            <LineChart data={chart.data}>
              <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
              <XAxis dataKey={chart.x ?? "period"} stroke={AXIS_COLOR} fontSize={12} />
              <YAxis stroke={AXIS_COLOR} fontSize={12} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Line type="monotone" dataKey={chart.y ?? "value"} stroke={color} strokeWidth={2} dot={false} />
            </LineChart>
          ) : (
            <BarChart data={chart.data}>
              <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke={AXIS_COLOR} fontSize={12} />
              <YAxis stroke={AXIS_COLOR} fontSize={12} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </>
  );
}

export function ChartCard({ chart }: { chart: ChartSpec }) {
  const emoji = chart.chart_type === "line" ? "📈" : "📊";
  return (
    <div className="card">
      <h3 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
        <span>{emoji}</span>
        {chart.title}
      </h3>
      <ChartBody chart={chart} />
    </div>
  );
}
