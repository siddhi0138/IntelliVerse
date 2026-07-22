"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listDatasets } from "@/lib/api";
import type { CatalogEntry } from "@/lib/types";

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export default function CatalogPage() {
  const [datasets, setDatasets] = useState<CatalogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDatasets()
      .then(setDatasets)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the catalog."));
  }, []);

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dataset Catalog</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Every dataset you&apos;ve uploaded — click a row to reopen its full dashboard, no re-upload needed. Features
            that need the live data (SQL query, re-running simulations/forecasts, the action plan) still require
            re-uploading the file, since only the computed result is saved, not the raw file itself.
          </p>
        </div>
        <Link href="/" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          &larr; Back to upload
        </Link>
      </header>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {datasets && datasets.length === 0 && <p className="text-sm text-slate-500">No datasets uploaded yet.</p>}

      {datasets && datasets.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
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
                  className="border-b border-slate-100 dark:border-slate-800/60 last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
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
