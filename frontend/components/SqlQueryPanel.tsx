"use client";

import { useState } from "react";
import { runSqlQuery } from "@/lib/api";
import type { QueryResult } from "@/lib/types";

export function SqlQueryPanel({ analysisId }: { analysisId: string }) {
  const [sql, setSql] = useState("SELECT * FROM df LIMIT 10");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const r = await runSqlQuery(analysisId, sql);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SQL Query (DuckDB)</h3>
      <p className="text-xs text-slate-500 mb-3">
        Ad-hoc SQL over your uploaded data — the table is called <code>df</code>. Read-only SELECT queries only.
      </p>

      <textarea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm font-mono"
      />
      <button
        onClick={run}
        disabled={loading}
        className="mt-2 rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-50"
      >
        {loading ? "Running…" : "Run Query"}
      </button>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>}

      {result && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-slate-500">
                {result.columns.map((c) => (
                  <th key={c} className="px-3 py-1.5 font-medium whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-700/60 last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-1.5 whitespace-nowrap">
                      {cell === null ? <span className="text-slate-400">null</span> : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-500 mt-2">
            {result.row_count} row(s){result.truncated && " (truncated at 1000)"}
          </p>
        </div>
      )}
    </div>
  );
}
