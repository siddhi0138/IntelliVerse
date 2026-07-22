"use client";

import { useState } from "react";
import { simulateEntityImpact } from "@/lib/api";
import type { EntityImpactResult } from "@/lib/types";

export function EntityImpactPanel({
  workspaceId,
  table,
  entityKey,
}: {
  workspaceId: string;
  table: string;
  entityKey: string;
}) {
  const [pct, setPct] = useState(20);
  const [result, setResult] = useState<EntityImpactResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const r = await simulateEntityImpact(workspaceId, table, entityKey, pct);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not simulate impact.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        Digital Twin: cascading impact from {table}:{entityKey}
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        Propagates a change through this entity&apos;s real confirmed graph connections — a structural estimate, not
        a statistical association.
      </p>

      <div className="flex items-center gap-3 mb-3">
        <input type="range" min={-50} max={50} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="w-40" />
        <span className="text-sm font-medium w-14">
          {pct > 0 ? "+" : ""}
          {pct}%
        </span>
        <button
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-50"
        >
          {loading ? "Simulating…" : "Simulate"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (
        <div>
          {result.affected_entities.length === 0 ? (
            <p className="text-sm text-slate-500">This entity has no connections to propagate through.</p>
          ) : (
            <ul className="space-y-1.5">
              {result.affected_entities.map((e, i) => (
                <li key={i} className="flex items-center justify-between text-sm gap-2">
                  <span>
                    {e.table}:{e.key}{" "}
                    <span className="text-xs text-slate-500">
                      ({e.hops} hop{e.hops > 1 ? "s" : ""}, share={e.contribution_share})
                    </span>
                  </span>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                      e.estimated_delta_pct >= 0
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {e.estimated_delta_pct > 0 ? "+" : ""}
                    {e.estimated_delta_pct}%
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500 mt-3">{result.note}</p>
        </div>
      )}
    </div>
  );
}
