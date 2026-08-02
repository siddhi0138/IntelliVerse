"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteSavedQuery, listSavedQueries, runSqlQuery, saveQuery } from "@/lib/api";
import type { QueryResult, SavedQuery } from "@/lib/types";

export function SqlQueryPanel({ analysisId }: { analysisId: string }) {
  const [sql, setSql] = useState("SELECT * FROM df LIMIT 10");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saved, setSaved] = useState<SavedQuery[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refreshSaved = useCallback(() => {
    listSavedQueries(analysisId)
      .then(setSaved)
      .catch(() => {});
  }, [analysisId]);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

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

  async function handleSave() {
    const label = window.prompt("Label this saved query:", sql.slice(0, 40));
    if (!label) return;
    setSaving(true);
    try {
      await saveQuery(analysisId, label, sql);
      refreshSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(savedId: string) {
    if (!window.confirm("Delete this saved query? This can't be undone.")) return;
    setDeletingId(savedId);
    try {
      await deleteSavedQuery(analysisId, savedId);
      refreshSaved();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="card p-4">
      <h3 className="text-base font-semibold text-foreground mb-1">SQL Query (DuckDB)</h3>
      <p className="text-xs text-muted mb-3">
        Ad-hoc SQL over your uploaded data — the table is called <code>df</code>. Read-only SELECT queries only.
      </p>

      <textarea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm font-mono"
      />
      <div className="flex items-center gap-2 mt-2">
        <button onClick={run} disabled={loading} className="btn-primary">
          {loading ? "Running…" : "Run Query"}
        </button>
        <button onClick={handleSave} disabled={saving || !sql.trim()} className="btn-secondary">
          {saving ? "Saving…" : "Save this query"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>}

      {result && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                {result.columns.map((c) => (
                  <th key={c} className="px-3 py-1.5 font-medium whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-1.5 whitespace-nowrap">
                      {cell === null ? <span className="text-muted">null</span> : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted mt-2">
            {result.row_count} row(s){result.truncated && " (truncated at 1000)"}
          </p>
        </div>
      )}

      {saved.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-white/[0.02] p-3">
          <h4 className="text-sm font-semibold text-foreground mb-2">Saved queries</h4>
          <ul className="space-y-1">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="truncate inline-block max-w-full align-bottom">{s.label}</span>{" "}
                  <span className="text-muted text-xs">({new Date(s.saved_at).toLocaleString()})</span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <button onClick={() => setSql(s.sql_text)} className="text-primary hover:underline text-xs">
                    Load
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={deletingId === s.id}
                    className="btn-danger-ghost disabled:opacity-50"
                  >
                    {deletingId === s.id ? "Deleting…" : "Delete"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
