import type { RootCauseAnalysis } from "@/lib/types";
import { rootCauseConfidence, rootCauseSentence } from "@/lib/plainLanguage";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { ExpandableDetail } from "./ExpandableDetail";
import { Term } from "./Term";
import { Panel, Badge, ProgressBar } from "./ui";
import { PALETTE } from "./charts";
import { GitBranch } from "lucide-react";

export function RootCausePanel({ rootCause }: { rootCause: RootCauseAnalysis | null }) {
  if (!rootCause || rootCause.dimensions.length === 0) {
    return (
      <Panel title="Root-cause analysis">
        <p className="text-sm text-muted">
          Nothing in this dataset stands out as a clear driver of {rootCause?.metric_label ?? "this metric"} yet.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Root-cause analysis"
      subtitle={`What explains changes in ${rootCause.metric_label}? ${rootCause.note}`}
      actions={
        <Badge tone="brand">
          <GitBranch className="h-3 w-3" /> {rootCause.dimensions.length} factor{rootCause.dimensions.length === 1 ? "" : "s"} identified
        </Badge>
      }
    >
      <div className="space-y-4">
        {rootCause.dimensions.map((d, i) => (
          <div key={d.dimension_column} className="group rounded-xl border border-border bg-white/[0.02] p-4">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs text-muted shrink-0 mt-0.5">#{i + 1}</span>
                <p className="text-sm text-foreground flex flex-wrap items-center gap-1">
                  {rootCauseSentence(d, rootCause.metric_label, false)}
                  <ExpandableDetail label="Show the statistical test">
                    <Term id={d.test_used === "anova" ? "anova" : "kruskal"}>
                      {d.test_used === "anova" ? "ANOVA" : "Kruskal-Wallis"}
                    </Term>
                    : statistic={d.test_statistic}, <Term id="pvalue">p</Term>=
                    {d.p_value} {d.significant ? "(statistically significant)" : "(not statistically significant)"}
                  </ExpandableDetail>
                </p>
              </div>
              <ConfidenceBadge level={rootCauseConfidence(d)} />
            </div>
            <ProgressBar value={d.variance_explained_pct} max={100} className="mt-2" hexColor={PALETTE[i % PALETTE.length]} />
            <p className="mt-2 text-xs text-muted">
              Biggest standout: <span className="font-medium text-foreground/80">{d.top_segment}</span>
              {d.top_segment_deviation_pct !== null && (
                <>
                  {" "}
                  ({d.top_segment_deviation_pct > 0 ? "+" : ""}
                  {d.top_segment_deviation_pct}% vs. the average)
                </>
              )}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
