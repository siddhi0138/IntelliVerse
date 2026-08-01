"use client";

import { useState, type ReactNode } from "react";
import type { RankedFinding } from "@/lib/types";
import { FINDING_KIND_LABELS, stripStats } from "@/lib/plainLanguage";
import { useSimpleMode } from "./SimpleModeContext";
import { Term } from "./Term";

const KIND_COLORS: Record<string, string> = {
  correlation: "bg-primary/15 text-primary",
  association: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  root_cause: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  anomaly: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

// The backend headline always ends in "(stat=value)" or "(stat, stat=value)"
// — mirrors insight_ranking.py's exact format per kind. Split off that
// parenthetical and re-render it with the technical word(s) as clickable
// glossary terms, instead of showing the full headline as plain text.
function findingHeadline(finding: RankedFinding): ReactNode {
  const match = finding.headline.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!match) return finding.headline;
  const [, prefix, suffix] = match;
  const evidence = finding.evidence as Record<string, unknown>;

  if (finding.kind === "correlation") {
    const method = evidence.method === "spearman" ? "spearman" : "pearson";
    const value = suffix.split("=")[1];
    return (
      <>
        {prefix} (<Term id={method}>r</Term>={value})
      </>
    );
  }

  if (finding.kind === "association") {
    const value = suffix.split("=")[1];
    return (
      <>
        {prefix} (<Term id="cramers_v">Cramér&apos;s V</Term>={value})
      </>
    );
  }

  if (finding.kind === "root_cause") {
    const [testPart, pPart] = suffix.split(", ");
    const isAnova = testPart === "anova";
    const pValue = pPart?.split("=")[1];
    return (
      <>
        {prefix} (<Term id={isAnova ? "anova" : "kruskal"}>{isAnova ? "ANOVA" : "Kruskal-Wallis"}</Term>
        {pValue ? (
          <>
            , <Term id="pvalue">p</Term>={pValue}
          </>
        ) : null}
        )
      </>
    );
  }

  if (finding.kind === "anomaly" && (suffix === "iqr" || suffix === "zscore")) {
    return (
      <>
        {prefix} (<Term id={suffix}>{suffix === "iqr" ? "IQR" : "Z-score"}</Term>)
      </>
    );
  }

  return finding.headline;
}

// Expert mode's headline already carries the full stat inline, so there's
// nothing left for a dropdown to reveal — it only makes sense in Simple
// mode, where the headline is the plain sentence and the raw evidence is a
// click away for anyone curious.
function EvidenceRow({ finding }: { finding: RankedFinding }) {
  const [open, setOpen] = useState(false);
  const { simpleMode } = useSimpleMode();

  if (!simpleMode) {
    return (
      <li className="border-b border-border/60 last:border-0 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm">{findingHeadline(finding)}</span>
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${KIND_COLORS[finding.kind] ?? ""}`}>
            {FINDING_KIND_LABELS[finding.kind] ?? finding.kind.replace("_", " ")}
          </span>
        </div>
      </li>
    );
  }

  return (
    <li className="group border-b border-border/60 last:border-0 py-2.5">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full text-left flex items-start justify-between gap-3"
      >
        <span className="text-sm flex items-center gap-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-3 h-3 shrink-0 transition-all ${open ? "rotate-180 opacity-100 text-primary" : "opacity-0 group-hover:opacity-100 text-muted"}`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
          {stripStats(finding.headline)}
        </span>
        <span
          className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${KIND_COLORS[finding.kind] ?? ""}`}
        >
          {FINDING_KIND_LABELS[finding.kind] ?? finding.kind.replace("_", " ")}
        </span>
      </button>
      {open && (
        <div className="mt-2 text-xs bg-surface/60 rounded-lg p-3 text-muted space-y-1">
          <p className="text-muted">{findingHeadline(finding)}</p>
          {Object.entries(finding.evidence).map(([k, v]) => (
            <p key={k}>
              <span className="text-muted">{k}:</span> {JSON.stringify(v)}
            </p>
          ))}
        </div>
      )}
    </li>
  );
}

export function RankedFindingsPanel({ findings }: { findings: RankedFinding[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-base font-semibold text-foreground mb-1">Insight Explorer</h3>
      <p className="text-xs text-muted mb-3">
        Ranked by how much they matter, not just how they look. Click one to see the numbers behind it.
      </p>

      {findings.length === 0 ? (
        <p className="text-sm text-muted">Nothing strong enough to call out yet — try a larger dataset.</p>
      ) : (
        <ul>
          {findings.map((f, i) => (
            <EvidenceRow key={i} finding={f} />
          ))}
        </ul>
      )}
    </div>
  );
}
