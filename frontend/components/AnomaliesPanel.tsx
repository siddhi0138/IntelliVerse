"use client";

import { useState } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { Anomaly } from "@/lib/types";
import { explainAnomaly } from "@/lib/api";
import { usePersona } from "./PersonaContext";
import { useSimpleMode } from "./SimpleModeContext";
import { Term } from "./Term";
import { Panel, Badge } from "./ui";

function AnomalyRow({ a, domain }: { a: Anomaly; domain: string }) {
  const { persona } = usePersona();
  const { simpleMode } = useSimpleMode();
  const [reasons, setReasons] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleClick() {
    setOpen((o) => !o);
    if (reasons || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await explainAnomaly(domain, a.semantic_label, a.value, a.direction, persona, simpleMode);
      setReasons(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not suggest reasons.");
    } finally {
      setLoading(false);
    }
  }

  const isAbove = a.direction === "above";

  return (
    <div className="flex flex-col gap-3 p-5 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          isAbove ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
        }`}
      >
        {isAbove ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-mono text-sm font-semibold text-foreground">{a.semantic_label}</p>
          <Badge tone={isAbove ? "bad" : "warn"}>{isAbove ? "higher" : "lower"}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted">{a.row}</p>
        {!simpleMode && (
          <p className="text-xs text-muted mt-0.5">
            Flagged by <Term id={a.method === "iqr" ? "iqr" : "zscore"}>{a.method === "iqr" ? "IQR" : "Z-score"}</Term>{" "}
            method: normal range is {a.bounds.lower.toLocaleString()}–{a.bounds.upper.toLocaleString()}.
          </p>
        )}
        <button onClick={handleClick} className="text-xs text-primary hover:underline mt-1">
          {open ? "Hide" : "Why might this have happened?"}
        </button>
        {open && (
          <div className="mt-1 text-xs text-muted">
            {loading && "Thinking…"}
            {error && <span title={error}>AI suggestions aren&apos;t available right now.</span>}
            {reasons && (
              <>
                <p className="italic mb-1">AI-generated guesses, not confirmed — a starting point to investigate:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-6 sm:gap-8 sm:shrink-0">
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted">Value</p>
          <p className="font-display text-lg font-bold text-foreground">{a.value.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted">Normal range</p>
          <p className="font-display text-sm text-muted">
            {a.bounds.lower.toLocaleString()}–{a.bounds.upper.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AnomaliesPanel({ anomalies, domain }: { anomalies: Anomaly[]; domain: string }) {
  const above = anomalies.filter((a) => a.direction === "above").length;
  const below = anomalies.length - above;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wider text-muted">Total anomalies</p>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">{anomalies.length}</p>
          <p className="mt-1 text-xs text-muted">single out-of-range values</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wider text-muted">Above normal</p>
          <p className="mt-2 font-display text-3xl font-bold text-red-400">{above}</p>
          <p className="mt-1 text-xs text-muted">higher than expected</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wider text-muted">Below normal</p>
          <p className="mt-2 font-display text-3xl font-bold text-amber-400">{below}</p>
          <p className="mt-1 text-xs text-muted">lower than expected</p>
        </div>
      </div>

      <Panel
        title="Detected anomalies"
        subtitle="Single values that are well outside the normal range for that column"
        bodyClassName="p-0"
      >
        {anomalies.length === 0 ? (
          <p className="p-5 text-sm text-muted">Nothing unusual found — every value looks like it&apos;s within a normal range.</p>
        ) : (
          <div className="divide-y divide-border">
            {anomalies.map((a, i) => (
              <AnomalyRow key={i} a={a} domain={domain} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
