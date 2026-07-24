import type { RiskAlert } from "@/lib/types";
import { percentConfidence } from "@/lib/plainLanguage";
import { ConfidenceBadge } from "./ConfidenceBadge";

function AlertBody({ a }: { a: RiskAlert }) {
  if (a.kind === "threshold_crossing") {
    return (
      <>
        <span className="font-medium">{a.metric}</span> is projected to hit a critical level (zero) within{" "}
        <span className="font-medium">{a.periods_until_critical} period(s)</span>.
      </>
    );
  }
  return (
    <>
      <span className="font-medium">{a.metric}</span> is projected to {a.direction}.
      {a.primary_driver && (
        <>
          {" "}
          Likely driver: <span className="font-medium">{a.primary_driver}</span>.
        </>
      )}
    </>
  );
}

export function RiskAlertsPanel({ alerts }: { alerts: RiskAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4">
      <h3 className="text-sm font-medium text-red-700 dark:text-red-300 mb-3">⚠ Future Risk Alerts</h3>
      <ul className="space-y-2">
        {alerts.map((a, i) => (
          <li key={i} className="text-sm">
            <div className="flex items-start justify-between gap-2">
              <p>
                <AlertBody a={a} />
              </p>
              <ConfidenceBadge level={percentConfidence(a.confidence_pct)} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{a.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
