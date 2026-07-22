"use client";

import type { RelationshipCandidate } from "@/lib/types";

export function RelationshipReviewPanel({
  candidates,
  confirmed,
  onToggle,
}: {
  candidates: RelationshipCandidate[];
  confirmed: Set<number>;
  onToggle: (index: number) => void;
}) {
  if (candidates.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Suggested Relationships</h3>
        <p className="text-sm text-slate-500">
          No relationships detected between these tables — matching column names had no meaningful value overlap.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Suggested Relationships</h3>
      <p className="text-xs text-slate-500 mb-3">
        Detected from column-name matches plus measured value overlap — review and confirm before the graph is built.
        Nothing here is assumed.
      </p>
      <ul className="space-y-2">
        {candidates.map((c, i) => (
          <li key={i} className="flex items-start gap-3 text-sm border-b border-slate-100 dark:border-slate-800/60 last:border-0 pb-2 last:pb-0">
            <input
              type="checkbox"
              checked={confirmed.has(i)}
              onChange={() => onToggle(i)}
              className="mt-1"
            />
            <div className="flex-1">
              <p>
                <span className="font-medium">
                  {c.from_table}.{c.from_column}
                </span>{" "}
                &rarr;{" "}
                <span className="font-medium">
                  {c.to_table}.{c.to_column}
                </span>{" "}
                <span className="text-xs text-slate-500">({c.relationship_type.replace("_", "-")})</span>
              </p>
              <p className="text-xs text-slate-500">{c.evidence}</p>
            </div>
            <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
              {Math.round(c.confidence * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
