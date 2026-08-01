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
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-base font-semibold text-foreground mb-2">AI Forecast Narrator</h3>
      {loading && <p className="text-sm text-muted">Explaining the forecast…</p>}
      {error && !loading && (
        <p className="text-sm text-red-600 dark:text-red-400" title={error}>
          AI explanation isn&apos;t available right now — the forecast above isn&apos;t affected.
        </p>
      )}
      {!loading && summary && <p className="text-sm text-foreground">{summary}</p>}
    </div>
  );
}
