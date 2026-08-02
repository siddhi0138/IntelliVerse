"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteAllDatasets, listDatasets } from "@/lib/api";
import { userScopedKey } from "@/lib/auth";
import type { CatalogEntry } from "@/lib/types";
import { PALETTE } from "@/components/charts";

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
      localStorage.removeItem(userScopedKey("nexus_last_analysis"));
      localStorage.removeItem(userScopedKey("nexus_last_filename"));
      localStorage.setItem("nexus_dataset_deleted", "ALL");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not empty the catalog.");
    } finally {
      setEmptying(false);
    }
  }

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">🗂️ Dataset Catalog</h1>
          <p className="text-muted mt-1 text-sm max-w-2xl">
            Every dataset you&apos;ve uploaded — click a row to reopen its full dashboard, no re-upload needed.
            SQL query, re-running simulations/forecasts, and the action plan still need the file re-uploaded, since
            only the computed result is saved.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {datasets && datasets.length > 0 && (
            <button onClick={handleEmptyCatalog} disabled={emptying} className="btn-danger whitespace-nowrap">
              {emptying ? "Emptying…" : "Empty catalog"}
            </button>
          )}
          <Link href="/" className="btn-secondary whitespace-nowrap rounded-full">
            &larr; Back to upload
          </Link>
        </div>
      </header>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

      {datasets && datasets.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-sm text-muted">No datasets uploaded yet.</p>
        </div>
      )}

      {datasets && datasets.length > 0 && (
        <>
          {/* Mobile: stacked cards — a wide table forced to scroll
              horizontally isn't a real mobile layout, and this dataset
              catalog is one of the first pages a phone-sized screen hits. */}
          <div className="space-y-3 sm:hidden">
            {datasets.map((d, i) => (
              <button
                key={d.analysis_id}
                onClick={() => (window.location.href = `/?reopen=${encodeURIComponent(d.analysis_id)}`)}
                className="card block w-full p-4 text-left"
                style={{ boxShadow: `inset 3px 0 0 0 ${PALETTE[i % PALETTE.length]}` }}
              >
                <p className="font-mono text-xs text-foreground truncate">{d.filename}</p>
                <p className="text-xs text-muted mt-1">{new Date(d.uploaded_at).toLocaleString()}</p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="badge">{d.domain}</span>
                  <span className="text-muted">
                    {d.row_count.toLocaleString()} &times; {d.column_count}
                  </span>
                  <span className={`font-semibold ${scoreColor(d.quality_score)}`}>{d.quality_score}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="hidden sm:block card p-0 overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-4 py-2 font-medium">Filename</th>
                  <th className="px-4 py-2 font-medium">Uploaded</th>
                  <th className="px-4 py-2 font-medium">Domain</th>
                  <th className="px-4 py-2 font-medium">Rows &times; Cols</th>
                  <th className="px-4 py-2 font-medium">Quality</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((d, i) => (
                  <tr
                    key={d.analysis_id}
                    onClick={() => (window.location.href = `/?reopen=${encodeURIComponent(d.analysis_id)}`)}
                    className="border-b border-border/60 last:border-0 cursor-pointer hover:bg-surface-elevated/60"
                    style={{ boxShadow: `inset 3px 0 0 0 ${PALETTE[i % PALETTE.length]}` }}
                  >
                    <td className="px-4 py-2 font-mono text-xs">{d.filename}</td>
                    <td className="px-4 py-2 text-muted">{new Date(d.uploaded_at).toLocaleString()}</td>
                    <td className="px-4 py-2">{d.domain}</td>
                    <td className="px-4 py-2 text-muted">
                      {d.row_count.toLocaleString()} &times; {d.column_count}
                    </td>
                    <td className={`px-4 py-2 font-medium ${scoreColor(d.quality_score)}`}>{d.quality_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
