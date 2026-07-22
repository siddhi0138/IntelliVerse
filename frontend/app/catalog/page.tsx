"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteAllDatasets, listDatasets } from "@/lib/api";
import type { CatalogEntry } from "@/lib/types";

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export default function CatalogPage() {
  const [datasets, setDatasets] = useState<CatalogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emptying, setEmptying] = useState(false);

  useEffect(() => {
    listDatasets()
      .then(setDatasets)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the catalog."));
  }, []);

  async function handleEmptyCatalog() {
    if (!datasets || datasets.length === 0) return;
    if (
      !window.confirm(
        `Permanently delete all ${datasets.length} dataset(s) in your catalog? This can't be undone.`
      )
    )
      return;
    setEmptying(true);
    setError(null);
    try {
      await deleteAllDatasets();
      setDatasets([]);
      // Same cross-tab pattern as a single delete — any other open tab
      // showing one of these (now-gone) datasets resets itself too.
      localStorage.removeItem("nexus_last_analysis");
      localStorage.setItem("nexus_dataset_deleted", "ALL");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not empty the catalog.");
    } finally {
      setEmptying(false);
    }
  }

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dataset Catalog</h1>
          <p className="text-slate-500 mt-1 text-sm max-w-2xl">
            Every dataset you&apos;ve uploaded — click a row to reopen its full dashboard, no re-upload needed.
            SQL query, re-running simulations/forecasts, and the action plan still need the file re-uploaded, since
            only the computed result is saved.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {datasets && datasets.length > 0 && (
            <button onClick={handleEmptyCatalog} disabled={emptying} className="btn-danger-ghost whitespace-nowrap">
              {emptying ? "Emptying…" : "Empty catalog"}
            </button>
          )}
          <Link
            href="/"
            className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full px-3 py-1.5 whitespace-nowrap"
          >
            &larr; Back to upload
          </Link>
        </div>
      </header>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

      {datasets && datasets.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-sm text-slate-500">No datasets uploaded yet.</p>
        </div>
      )}

      {datasets && datasets.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-600 text-left text-slate-500">
                <th className="px-4 py-2 font-medium">Filename</th>
                <th className="px-4 py-2 font-medium">Uploaded</th>
                <th className="px-4 py-2 font-medium">Domain</th>
                <th className="px-4 py-2 font-medium">Rows &times; Cols</th>
                <th className="px-4 py-2 font-medium">Quality</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr
                  key={d.analysis_id}
                  onClick={() => (window.location.href = `/?reopen=${encodeURIComponent(d.analysis_id)}`)}
                  className="border-b border-slate-100 dark:border-slate-600/60 last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40"
                >
                  <td className="px-4 py-2 font-mono text-xs">{d.filename}</td>
                  <td className="px-4 py-2 text-slate-500">{new Date(d.uploaded_at).toLocaleString()}</td>
                  <td className="px-4 py-2">{d.domain}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {d.row_count.toLocaleString()} &times; {d.column_count}
                  </td>
                  <td className={`px-4 py-2 font-medium ${scoreColor(d.quality_score)}`}>{d.quality_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
