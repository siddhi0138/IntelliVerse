"use client";

import { useState } from "react";
import type { RankedFinding } from "@/lib/types";
import { FINDING_KIND_LABELS, stripStats } from "@/lib/plainLanguage";

const KIND_COLORS: Record<string, string> = {
  correlation: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  association: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  root_cause: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  anomaly: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function EvidenceRow({ finding }: { finding: RankedFinding }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="border-b border-slate-100 dark:border-slate-800/60 last:border-0 py-2.5">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left flex items-start justify-between gap-3">
        <span className="text-sm">{stripStats(finding.headline)}</span>
        <span
          className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${KIND_COLORS[finding.kind] ?? ""}`}
        >
          {FINDING_KIND_LABELS[finding.kind] ?? finding.kind.replace("_", " ")}
        </span>
      </button>
      {open && (
        <div className="mt-2 text-xs bg-slate-50 dark:bg-slate-900/60 rounded-lg p-3 text-slate-600 dark:text-slate-400 space-y-1">
          <p className="text-slate-500">{finding.headline}</p>
          {Object.entries(finding.evidence).map(([k, v]) => (
            <p key={k}>
              <span className="text-slate-400">{k}:</span> {JSON.stringify(v)}
            </p>
          ))}
        </div>
      )}
    </li>
  );
}

export function RankedFindingsPanel({ findings }: { findings: RankedFinding[] }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Insight Explorer</h3>
      <p className="text-xs text-slate-500 mb-3">
        Ranked by how much they matter, not just how they look. Click one to see the numbers behind it.
      </p>

      {findings.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing strong enough to call out yet — try a larger dataset.</p>
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
