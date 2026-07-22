"use client";

import { useEffect, useState } from "react";
import { fetchDatasetSummary } from "@/lib/api";
import type { ColumnSchema, DataQualityReport } from "@/lib/types";

export function DatasetSummaryPanel({
  domain,
  rowCount,
  columnCount,
  schema,
  quality,
}: {
  domain: string;
  rowCount: number;
  columnCount: number;
  schema: ColumnSchema[];
  quality: DataQualityReport;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchDatasetSummary(domain, rowCount, columnCount, schema, quality);
        if (!cancelled) setSummary(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not generate a summary.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, rowCount, columnCount]);

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20 p-4">
      {loading && <p className="text-sm text-slate-500">Summarizing this dataset…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!loading && summary && <p className="text-sm text-slate-700 dark:text-slate-300">{summary}</p>}
    </div>
  );
}
