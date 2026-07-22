import type { CategoricalAssociation, NumericCorrelation } from "@/lib/types";

const STRENGTH_COLORS: Record<string, string> = {
  strong: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  moderate: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  weak: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
};

export function RelationshipsPanel({
  correlations,
  associations,
}: {
  correlations: NumericCorrelation[];
  associations: CategoricalAssociation[];
}) {
  const hasAny = correlations.length > 0 || associations.length > 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Relationships</h3>

      {!hasAny && <p className="text-sm text-slate-500">No statistically meaningful relationships detected.</p>}

      {correlations.length > 0 && (
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Numeric correlations</p>
          <ul className="space-y-1.5">
            {correlations.map((c, i) => (
              <li key={i} className="flex items-center justify-between text-sm gap-2">
                <span>
                  {c.label_a} &harr; {c.label_b}
                  <span className="text-xs text-slate-500 ml-1">
                    ({c.method}, p={c.p_value}
                    {c.significant ? "" : ", n.s."})
                  </span>
                </span>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${STRENGTH_COLORS[c.strength]}`}>
                  r={c.r} ({c.direction})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {associations.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Categorical associations</p>
          <ul className="space-y-1.5">
            {associations.map((a, i) => (
              <li key={i} className="flex items-center justify-between text-sm gap-2">
                <span>
                  {a.label_a} &harr; {a.label_b}
                </span>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${STRENGTH_COLORS[a.strength]}`}>
                  V={a.cramers_v}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
