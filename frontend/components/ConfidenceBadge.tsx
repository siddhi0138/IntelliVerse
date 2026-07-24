import type { ConfidenceLevel } from "@/lib/plainLanguage";

const CONFIG: Record<ConfidenceLevel, { dot: string; label: string; classes: string }> = {
  high: { dot: "🟢", label: "High confidence", classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  medium: { dot: "🟡", label: "Medium confidence", classes: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  low: { dot: "🔴", label: "Low confidence", classes: "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400" },
};

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const c = CONFIG[level];
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.classes}`}>
      {c.dot} {c.label}
    </span>
  );
}
