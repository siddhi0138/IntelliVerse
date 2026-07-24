import type { CategoricalAssociation, NumericCorrelation, RootCauseDimension } from "./types";

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

/** "Sales and Marketing move together very strongly." */
export function correlationSentence(c: NumericCorrelation): string {
  const together = c.direction === "positive" ? "move together" : "move in opposite directions";
  const intensity = c.strength === "strong" ? "very strongly" : c.strength === "moderate" ? "somewhat" : "only slightly";
  return `${c.label_a} and ${c.label_b} ${together} ${intensity}.`;
}

export function associationSentence(a: CategoricalAssociation): string {
  const intensity = a.strength === "strong" ? "strongly linked" : a.strength === "moderate" ? "somewhat linked" : "only loosely linked";
  return `${a.label_a} and ${a.label_b} are ${intensity}.`;
}

/** "Region explains around 72% of the variation in Revenue." */
export function rootCauseSentence(d: RootCauseDimension, metricLabel: string): string {
  return `${d.dimension_label} explains around ${Math.round(d.variance_explained_pct)}% of the variation in ${metricLabel}.`;
}
