import type { InsightTimelineEntry } from "@/lib/types";

export function InsightTimelinePanel({ timeline }: { timeline: InsightTimelineEntry[] }) {
  if (timeline.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">Insight Timeline</h3>
      <ol className="relative border-l border-slate-200 dark:border-slate-600 ml-2 space-y-4">
        {timeline.map((entry) => (
          <li key={entry.period} className="ml-4">
            <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-indigo-500" />
            <p className="text-sm font-medium">
              {entry.period} &middot; {entry.value.toLocaleString()}
            </p>
            <ul className="text-xs text-slate-500 list-disc list-inside">
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
