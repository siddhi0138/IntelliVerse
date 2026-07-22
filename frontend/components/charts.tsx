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
const SERIES_COLOR = "#6366f1";

export function KpiRow({ chart }: { chart: ChartSpec }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {chart.data.map((item, i) => (
        <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-600 p-4 bg-white dark:bg-slate-700">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {String(item.label)}
          </div>
          <div className="text-2xl font-semibold mt-1">
            {typeof item.value === "number" ? item.value.toLocaleString() : String(item.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartCard({ chart }: { chart: ChartSpec }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-4 bg-white dark:bg-slate-700">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">{chart.title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {chart.chart_type === "line" ? (
            <LineChart data={chart.data}>
              <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
              <XAxis dataKey={chart.x ?? "period"} stroke={AXIS_COLOR} fontSize={12} />
              <YAxis stroke={AXIS_COLOR} fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey={chart.y ?? "value"} stroke={SERIES_COLOR} strokeWidth={2} dot={false} />
            </LineChart>
          ) : (
            <BarChart data={chart.data}>
              <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke={AXIS_COLOR} fontSize={12} />
              <YAxis stroke={AXIS_COLOR} fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill={SERIES_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
