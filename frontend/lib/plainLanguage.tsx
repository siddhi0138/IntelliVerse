import type { ReactNode } from "react";
import type { CategoricalAssociation, NumericCorrelation, RootCauseDimension } from "./types";
import { Term } from "@/components/Term";

export type ConfidenceLevel = "high" | "medium" | "low";

/** Mirrors backend/report.py's _plain_headline — strips a trailing "(r=0.82)"
 * style parenthetical so the plain-English sentence is what's read first. */
export function stripStats(headline: string): string {
  const plain = headline.replace(/\s*\([^()]*\)\s*$/, "").trim();
  return plain || headline;
}

export const FINDING_KIND_LABELS: Record<string, string> = {
  correlation: "Relationship",
  association: "Relationship",
  root_cause: "Biggest influencer",
  anomaly: "Unusual record",
};

export function correlationConfidence(c: NumericCorrelation): ConfidenceLevel {
  if (!c.significant) return "low";
  return c.strength === "strong" ? "high" : "medium";
}

export function associationConfidence(a: CategoricalAssociation): ConfidenceLevel {
  if (!a.significant) return "low";
  return a.strength === "strong" ? "high" : "medium";
}

export function rootCauseConfidence(d: RootCauseDimension): ConfidenceLevel {
  if (!d.significant) return "low";
  return d.variance_explained_pct >= 50 ? "high" : "medium";
}

export function forecastConfidence(mapePercent: number | null): ConfidenceLevel {
  if (mapePercent === null) return "medium";
  if (mapePercent <= 10) return "high";
  if (mapePercent <= 25) return "medium";
  return "low";
}

export function percentConfidence(pct: number | null): ConfidenceLevel {
  if (pct === null) return "medium";
  if (pct >= 80) return "high";
  if (pct >= 50) return "medium";
  return "low";
}

export function clusteringConfidence(silhouetteScore: number): ConfidenceLevel {
  if (silhouetteScore >= 0.5) return "high";
  if (silhouetteScore >= 0.25) return "medium";
  return "low";
}

/** Two genuinely different sentences, not one sentence with stats bolted on:
 * Simple reads like a person describing what they see ("move together very
 * strongly"), no jargon to click through. Expert reads like an analyst's
 * write-up — same statistical vocabulary as the Simple-mode dropdown used
 * to hold, so every technical word (pearson/spearman, p, Cramér's V, ANOVA)
 * is still a clickable glossary term, just inline instead of hidden. */
export function correlationSentence(c: NumericCorrelation, detailed = false): ReactNode {
  if (!detailed) {
    const together = c.direction === "positive" ? "move together" : "move in opposite directions";
    const intensity = c.strength === "strong" ? "very strongly" : c.strength === "moderate" ? "somewhat" : "only slightly";
    return `${c.label_a} and ${c.label_b} ${together} ${intensity}.`;
  }
  const sig = c.significant ? "statistically significant" : "not statistically significant";
  const methodId = c.method === "spearman" ? "spearman" : "pearson";
  return (
    <>
      {c.label_a} and {c.label_b} show a {c.strength} {c.direction} <Term id={methodId}>{c.method}</Term>{" "}
      correlation: <Term id={methodId}>r</Term>={c.r}, <Term id="pvalue">p</Term>={c.p_value} ({sig}).
    </>
  );
}

export function associationSentence(a: CategoricalAssociation, detailed = false): ReactNode {
  if (!detailed) {
    const intensity = a.strength === "strong" ? "strongly linked" : a.strength === "moderate" ? "somewhat linked" : "only loosely linked";
    return `${a.label_a} and ${a.label_b} are ${intensity}.`;
  }
  const sig = a.significant ? "statistically significant" : "not statistically significant";
  return (
    <>
      {a.label_a} and {a.label_b} show a {a.strength} association: <Term id="cramers_v">Cramér&apos;s V</Term>=
      {a.cramers_v}, <Term id="pvalue">p</Term>={a.p_value} ({sig}).
    </>
  );
}

export function rootCauseSentence(d: RootCauseDimension, metricLabel: string, detailed = false): ReactNode {
  if (!detailed) {
    return `${d.dimension_label} explains around ${Math.round(d.variance_explained_pct)}% of the variation in ${metricLabel}.`;
  }
  const sig = d.significant ? "statistically significant" : "not statistically significant";
  return (
    <>
      {d.dimension_label} accounts for {d.variance_explained_pct.toFixed(1)}%{" "}
      of <Term id="variance_explained">variance</Term> in {metricLabel}:{" "}
      <Term id={d.test_used === "anova" ? "anova" : "kruskal"}>{d.test_used === "anova" ? "ANOVA" : "Kruskal-Wallis"}</Term>{" "}
      statistic={d.test_statistic}, <Term id="pvalue">p</Term>={d.p_value} ({sig}).
    </>
  );
}
