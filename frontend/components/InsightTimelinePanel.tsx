import type { InsightTimelineEntry } from "@/lib/types";

export function InsightTimelinePanel({ timeline }: { timeline: InsightTimelineEntry[] }) {
  if (timeline.length === 0) return null;

  return (
    <div className="card p-4">
      <h3 className="text-base font-semibold text-foreground mb-3">Insight Timeline</h3>
      <ol className="relative border-l border-border ml-2 space-y-4">
        {timeline.map((entry) => (
          <li key={entry.period} className="ml-4">
            <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-primary" />
            <p className="text-sm font-medium">
              {entry.period} &middot; {entry.value.toLocaleString()}
            </p>
            <ul className="text-xs text-muted list-disc list-inside">
              {entry.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
