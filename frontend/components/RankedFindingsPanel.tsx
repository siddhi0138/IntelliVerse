"use client";

import { useState } from "react";
import type { RankedFinding } from "@/lib/types";

const KIND_COLORS: Record<string, string> = {
  correlation: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  association: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  root_cause: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  anomaly: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function EvidenceRow({ finding }: { finding: RankedFinding }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="border-b border-slate-100 dark:border-slate-600/60 last:border-0 py-2.5">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left flex items-start justify-between gap-3">
        <span className="text-sm">{finding.headline}</span>
        <span
          className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${KIND_COLORS[finding.kind] ?? ""}`}
        >
          {finding.kind.replace("_", " ")}
        </span>
      </button>
      {open && (
        <pre className="mt-2 text-xs bg-slate-50 dark:bg-slate-700/60 rounded-lg p-3 overflow-x-auto text-slate-600 dark:text-slate-400">
          {JSON.stringify(finding.evidence, null, 2)}
        </pre>
      )}
    </li>
  );
}

export function RankedFindingsPanel({ findings }: { findings: RankedFinding[] }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Insight Explorer</h3>
      <p className="text-xs text-slate-500 mb-3">
        Ranked by magnitude and statistical significance. Click a finding to inspect the supporting evidence.
      </p>

      {findings.length === 0 ? (
        <p className="text-sm text-slate-500">No statistically meaningful findings detected.</p>
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
