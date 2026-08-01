import type { SimulationResult } from "@/lib/types";
import { Term } from "./Term";

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-surface text-muted",
};

export function EffectsList({ result }: { result: SimulationResult }) {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-4 py-2 font-medium">Metric</th>
            <th className="px-4 py-2 font-medium">Baseline</th>
            <th className="px-4 py-2 font-medium">Projected</th>
            <th className="px-4 py-2 font-medium">Change</th>
            <th className="px-4 py-2 font-medium">
              Confidence (<Term id="r_squared">R&sup2;</Term>)
            </th>
            <th className="px-4 py-2 font-medium">Relationship</th>
          </tr>
        </thead>
        <tbody>
          {result.effects.map((e) => (
            <tr key={e.column} className="border-b border-border/60 last:border-0">
              <td className="px-4 py-2 font-medium">{e.semantic_label}</td>
              <td className="px-4 py-2 text-muted">{e.baseline.toLocaleString()}</td>
              <td className="px-4 py-2 text-muted">{e.projected.toLocaleString()}</td>
              <td className="px-4 py-2">
                {e.delta_pct === null ? "—" : `${e.delta_pct > 0 ? "+" : ""}${e.delta_pct.toFixed(1)}%`}
              </td>
              <td className="px-4 py-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CONFIDENCE_COLORS[e.confidence]}`}>
                  {e.confidence} ({e.r_squared.toFixed(2)})
                </span>
              </td>
              <td className="px-4 py-2 text-muted text-xs">{e.relationship}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-3 text-xs text-muted border-t border-border/60">
        {result.note}
      </p>
    </div>
  );
}
