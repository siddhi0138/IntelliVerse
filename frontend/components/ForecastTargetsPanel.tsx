import type { ForecastableTarget } from "@/lib/types";

export function ForecastTargetsPanel({
  targets,
  selectedColumn,
  onSelect,
}: {
  targets: ForecastableTarget[];
  selectedColumn: string | null;
  onSelect: (column: string) => void;
}) {
  if (targets.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-base font-semibold text-foreground mb-3">Forecastable Targets</h3>
      <div className="flex flex-wrap gap-2">
        {targets.map((t) => (
          <button
            key={t.column}
            onClick={() => t.eligible && onSelect(t.column)}
            disabled={!t.eligible}
            title={t.reason ?? undefined}
            className={`rounded-full border px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed ${
              selectedColumn === t.column
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/60"
            }`}
          >
            {t.semantic_label} ({Math.round(t.confidence * 100)}%)
          </button>
        ))}
      </div>
    </div>
  );
}
