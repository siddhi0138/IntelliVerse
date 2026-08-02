import type { GEValidation } from "@/lib/types";
import { Term } from "./Term";

export function GEValidationPanel({ validation }: { validation: GEValidation }) {
  if (!validation.available) {
    return (
      <div className="card p-4">
        <h3 className="text-base font-semibold text-foreground mb-2">Structural Validation</h3>
        <p className="text-sm text-muted"><Term id="great_expectations">Great Expectations</Term> check unavailable: {validation.reason}</p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <h3 className="text-base font-semibold text-foreground mb-1">Structural Validation</h3>
      <p className="text-xs text-muted mb-3">
        <Term id="great_expectations">Great Expectations</Term> — generic structural checks (row count, uniqueness, nullness), supplementary to the
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
            <li key={i} className="text-xs text-muted">
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
