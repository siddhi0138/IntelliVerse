import type { SimulationResult } from "@/lib/types";

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400",
};

export function EffectsList({ result }: { result: SimulationResult }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
            <th className="px-4 py-2 font-medium">Metric</th>
            <th className="px-4 py-2 font-medium">Baseline</th>
            <th className="px-4 py-2 font-medium">Projected</th>
            <th className="px-4 py-2 font-medium">Change</th>
            <th className="px-4 py-2 font-medium">Confidence (R²)</th>
            <th className="px-4 py-2 font-medium">Relationship</th>
          </tr>
        </thead>
        <tbody>
          {result.effects.map((e) => (
            <tr key={e.column} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
              <td className="px-4 py-2 font-medium">{e.semantic_label}</td>
              <td className="px-4 py-2 text-slate-500">{e.baseline.toLocaleString()}</td>
              <td className="px-4 py-2 text-slate-500">{e.projected.toLocaleString()}</td>
              <td className="px-4 py-2">
                {e.delta_pct === null ? "—" : `${e.delta_pct > 0 ? "+" : ""}${e.delta_pct.toFixed(1)}%`}
              </td>
              <td className="px-4 py-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CONFIDENCE_COLORS[e.confidence]}`}>
                  {e.confidence} ({e.r_squared.toFixed(2)})
                </span>
              </td>
              <td className="px-4 py-2 text-slate-500 text-xs">{e.relationship}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800/60">
        {result.note}
      </p>
    </div>
  );
}
