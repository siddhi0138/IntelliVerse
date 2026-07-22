import type { SimulationResult } from "@/lib/types";

export function ScenarioComparisonTable({
  scenarios,
}: {
  scenarios: { name: string; result: SimulationResult }[];
}) {
  if (scenarios.length === 0) return null;

  const metricColumns = scenarios[0].result.effects.map((e) => ({ column: e.column, label: e.semantic_label }));

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-600 text-left text-slate-500">
            <th className="px-4 py-2 font-medium">Metric</th>
            {scenarios.map((s) => (
              <th key={s.name} className="px-4 py-2 font-medium text-right">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metricColumns.map((metric) => (
            <tr key={metric.column} className="border-b border-slate-100 dark:border-slate-600/60 last:border-0">
              <td className="px-4 py-2 font-medium">{metric.label}</td>
              {scenarios.map((s) => {
                const effect = s.result.effects.find((e) => e.column === metric.column);
                return (
                  <td key={s.name} className="px-4 py-2 text-right">
                    {effect?.delta_pct === null || effect?.delta_pct === undefined
                      ? "—"
                      : `${effect.delta_pct > 0 ? "+" : ""}${effect.delta_pct.toFixed(1)}%`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
