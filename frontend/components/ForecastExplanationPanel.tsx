export function ForecastExplanationPanel({
  summary,
  loading,
  error,
}: {
  summary: string | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">AI Forecast Narrator</h3>
      {loading && <p className="text-sm text-slate-500">Explaining the forecast…</p>}
      {error && !loading && (
        <p className="text-sm text-red-600 dark:text-red-400" title={error}>
          AI explanation isn&apos;t available right now — the forecast above isn&apos;t affected.
        </p>
      )}
      {!loading && summary && <p className="text-sm text-slate-700 dark:text-slate-300">{summary}</p>}
    </div>
  );
}
