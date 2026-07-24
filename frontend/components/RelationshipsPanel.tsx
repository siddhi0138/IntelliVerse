import type { CategoricalAssociation, NumericCorrelation } from "@/lib/types";
import { correlationConfidence, associationConfidence, correlationSentence, associationSentence } from "@/lib/plainLanguage";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { ExpandableDetail } from "./ExpandableDetail";
import { Term } from "./Term";

export function RelationshipsPanel({
  correlations,
  associations,
}: {
  correlations: NumericCorrelation[];
  associations: CategoricalAssociation[];
}) {
  const hasAny = correlations.length > 0 || associations.length > 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Relationships</h3>
      <p className="text-xs text-slate-500 mb-3">Which things in your data tend to move together.</p>

      {!hasAny && <p className="text-sm text-slate-500">Nothing in this dataset moves together strongly enough to call out.</p>}

      {(correlations.length > 0 || associations.length > 0) && (
        <ul className="space-y-3">
          {correlations.map((c, i) => (
            <li key={`c-${i}`} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0 pb-3 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm">📈 {correlationSentence(c)}</p>
                <ConfidenceBadge level={correlationConfidence(c)} />
              </div>
              <ExpandableDetail>
                <Term id={c.method === "spearman" ? "spearman" : "pearson"}>{c.method}</Term> correlation r={c.r} (
                {c.direction}), <Term id="pvalue">p</Term>={c.p_value}
                {c.significant ? "" : " (not statistically significant)"}
              </ExpandableDetail>
            </li>
          ))}
          {associations.map((a, i) => (
            <li key={`a-${i}`} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0 pb-3 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm">📈 {associationSentence(a)}</p>
                <ConfidenceBadge level={associationConfidence(a)} />
              </div>
              <ExpandableDetail>
                <Term id="cramers_v">Cramér&apos;s V</Term>={a.cramers_v}, <Term id="pvalue">p</Term>={a.p_value}
                {a.significant ? "" : " (not statistically significant)"}
              </ExpandableDetail>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
