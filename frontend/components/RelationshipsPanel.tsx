import type { CategoricalAssociation, NumericCorrelation } from "@/lib/types";
import { correlationConfidence, associationConfidence, correlationSentence, associationSentence } from "@/lib/plainLanguage";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { ExpandableDetail } from "./ExpandableDetail";
import { Term } from "./Term";
import { useSimpleMode } from "./SimpleModeContext";

export function RelationshipsPanel({
  correlations,
  associations,
}: {
  correlations: NumericCorrelation[];
  associations: CategoricalAssociation[];
}) {
  const { simpleMode } = useSimpleMode();
  const hasAny = correlations.length > 0 || associations.length > 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-base font-semibold text-foreground mb-1">Relationships</h3>
      <p className="text-xs text-muted mb-3">Which things in your data tend to move together.</p>

      {!hasAny && <p className="text-sm text-muted">Nothing in this dataset moves together strongly enough to call out.</p>}

      {(correlations.length > 0 || associations.length > 0) && (
        <ul className="space-y-3">
          {correlations.map((c, i) => (
            <li key={`c-${i}`} className="group border-b border-border/60 last:border-0 pb-3 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1 flex-1 min-w-0">
                  <p className="text-sm">📈 {correlationSentence(c, !simpleMode)}</p>
                  {simpleMode && (
                    <ExpandableDetail>
                      <Term id={c.method === "spearman" ? "spearman" : "pearson"}>{c.method}</Term> correlation{" "}
                      <Term id={c.method === "spearman" ? "spearman" : "pearson"}>r</Term>={c.r} ({c.direction}),{" "}
                      <Term id="pvalue">p</Term>={c.p_value}
                      {c.significant ? "" : " (not statistically significant)"}
                    </ExpandableDetail>
                  )}
                </div>
                <ConfidenceBadge level={correlationConfidence(c)} />
              </div>
            </li>
          ))}
          {associations.map((a, i) => (
            <li key={`a-${i}`} className="group border-b border-border/60 last:border-0 pb-3 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1 flex-1 min-w-0">
                  <p className="text-sm">📈 {associationSentence(a, !simpleMode)}</p>
                  {simpleMode && (
                    <ExpandableDetail>
                      <Term id="cramers_v">Cramér&apos;s V</Term>={a.cramers_v}, <Term id="pvalue">p</Term>={a.p_value}
                      {a.significant ? "" : " (not statistically significant)"}
                    </ExpandableDetail>
                  )}
                </div>
                <ConfidenceBadge level={associationConfidence(a)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
