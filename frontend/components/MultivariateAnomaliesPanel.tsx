"use client";

import type { MultivariateAnomaly } from "@/lib/types";
import type { ConfidenceLevel } from "@/lib/plainLanguage";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { ExpandableDetail } from "./ExpandableDetail";
import { Term } from "./Term";
import { useSimpleMode } from "./SimpleModeContext";
import type { GlossaryKey } from "@/lib/glossary";

const METHOD_LABELS: Record<string, string> = {
  isolation_forest: "Isolation Forest",
  local_outlier_factor: "Local Outlier Factor",
  one_class_svm: "One-Class SVM",
};

function consensusConfidence(consensus: number): ConfidenceLevel {
  if (consensus >= 3) return "high";
  if (consensus === 2) return "medium";
  return "low";
}

function WhyFlagged({ a }: { a: MultivariateAnomaly }) {
  return (
    <>
      Detected by {a.consensus} of 3 detection methods:{" "}
      {a.detected_by.map((m, mi) => (
        <span key={m}>
          <Term id={m as GlossaryKey}>{METHOD_LABELS[m] ?? m}</Term>
          {mi < a.detected_by.length - 1 ? ", " : ""}
        </span>
      ))}
      {a.top_contributing_features && (
        <>
          <br />
          Biggest contributors (<Term id="shap">SHAP</Term>):{" "}
          {a.top_contributing_features.map((f) => `${f.feature} (${f.impact > 0 ? "+" : ""}${f.impact})`).join(", ")}
        </>
      )}
    </>
  );
}

export function MultivariateAnomaliesPanel({ anomalies }: { anomalies: MultivariateAnomaly[] }) {
  const { simpleMode } = useSimpleMode();
  if (anomalies.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-base font-semibold text-foreground mb-1">Multivariate Anomalies</h3>
      <p className="text-xs text-muted mb-3">
        Rows that look strange across a *combination* of columns at once, not just one — a stronger signal than a
        single-column outlier.
      </p>
      <ul className="space-y-3">
        {anomalies.map((a, i) => (
          <li key={i} className="group text-sm border-b border-border/60 last:border-0 pb-3 last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{a.row}</span>
              <ConfidenceBadge level={consensusConfidence(a.consensus)} />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <p className="text-xs text-muted mt-0.5">
                {Object.entries(a.values)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(", ")}
              </p>
              {simpleMode && (
                <ExpandableDetail label="Why was this flagged?">
                  <WhyFlagged a={a} />
                </ExpandableDetail>
              )}
            </div>
            {!simpleMode && (
              <p className="text-xs text-muted mt-1">
                <WhyFlagged a={a} />
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
