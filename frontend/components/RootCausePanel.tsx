import type { RootCauseAnalysis } from "@/lib/types";
import { rootCauseConfidence, rootCauseSentence } from "@/lib/plainLanguage";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { ExpandableDetail } from "./ExpandableDetail";
import { Term } from "./Term";
import { useSimpleMode } from "./SimpleModeContext";

export function RootCausePanel({ rootCause }: { rootCause: RootCauseAnalysis | null }) {
  const { simpleMode } = useSimpleMode();
  if (!rootCause || rootCause.dimensions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">Root Cause Breakdown</h3>
        <p className="text-sm text-slate-500">Nothing in this dataset stands out as a clear driver of {rootCause?.metric_label ?? "this metric"} yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
        What explains changes in {rootCause.metric_label}?
      </h3>
      <p className="text-xs text-slate-500 mb-3">{rootCause.note}</p>
      <ul className="space-y-3">
        {rootCause.dimensions.map((d) => (
          <li key={d.dimension_column} className="group">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-sm">{rootCauseSentence(d, rootCause.metric_label, !simpleMode)}</p>
              <ConfidenceBadge level={rootCauseConfidence(d)} />
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-900 mb-1">
              <div
                className="h-2 rounded-full bg-indigo-500"
                style={{ width: `${Math.min(d.variance_explained_pct, 100)}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <p className="text-xs text-slate-500">
                Biggest standout: <span className="font-medium">{d.top_segment}</span>
                {d.top_segment_deviation_pct !== null && (
                  <>
                    {" "}
                    ({d.top_segment_deviation_pct > 0 ? "+" : ""}
                    {d.top_segment_deviation_pct}% vs. the average)
                  </>
                )}
              </p>
              {simpleMode && (
                <ExpandableDetail>
                  <Term id={d.test_used === "anova" ? "anova" : "kruskal"}>
                    {d.test_used === "anova" ? "ANOVA" : "Kruskal-Wallis"}
                  </Term>
                  : statistic={d.test_statistic}, <Term id="pvalue">p</Term>=
                  {d.p_value} {d.significant ? "(statistically significant)" : "(not statistically significant)"}
                </ExpandableDetail>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
