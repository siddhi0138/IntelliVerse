import type { GEValidation } from "@/lib/types";

export function GEValidationPanel({ validation }: { validation: GEValidation }) {
  if (!validation.available) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Structural Validation</h3>
        <p className="text-sm text-slate-500">Great Expectations check unavailable: {validation.reason}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Structural Validation</h3>
      <p className="text-xs text-slate-500 mb-3">
        Great Expectations — generic structural checks (row count, uniqueness, nullness), supplementary to the
        business-aware quality report above.
      </p>
      <p className="text-sm mb-2">
        {validation.expectations_run} expectations run,{" "}
        <span className={validation.success ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
          {validation.success ? "all passed" : `${validation.failed?.length ?? 0} failed`}
        </span>
      </p>
      {validation.failed && validation.failed.length > 0 && (
        <ul className="space-y-1">
          {validation.failed.map((f, i) => (
            <li key={i} className="text-xs text-slate-500">
              {f.expectation}
              {f.column && ` on ${f.column}`}: {f.unexpected_count} unexpected value(s)
              {f.unexpected_percent !== null && ` (${f.unexpected_percent.toFixed(1)}%)`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
