"use client";

import { useState } from "react";
import type { Anomaly } from "@/lib/types";
import { explainAnomaly } from "@/lib/api";
import { usePersona } from "./PersonaContext";

function AnomalyRow({ a, domain }: { a: Anomaly; domain: string }) {
  const { persona } = usePersona();
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
      const result = await explainAnomaly(domain, a.semantic_label, a.value, a.direction, persona);
      setReasons(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not suggest reasons.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="text-sm">
      <div className="flex items-center justify-between gap-3">
        <span>
          <span className="font-medium">{a.semantic_label}</span>
          <span className="text-slate-500"> &middot; {a.row}</span>
        </span>
        <span
          className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
            a.direction === "above"
              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
              : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          }`}
        >
          {a.value.toLocaleString()} ({a.direction === "above" ? "higher" : "lower"} than normal)
        </span>
      </div>
      <button onClick={handleClick} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-0.5">
        {open ? "Hide" : "Why might this have happened?"}
      </button>
      {open && (
        <div className="mt-1 text-xs text-slate-500">
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
    </li>
  );
}

export function AnomaliesPanel({ anomalies, domain }: { anomalies: Anomaly[]; domain: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Anomalies</h3>
      <p className="text-xs text-slate-500 mb-3">Single values that are well outside the normal range for that column.</p>

      {anomalies.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing unusual found — every value looks like it&apos;s within a normal range.</p>
      ) : (
        <ul className="space-y-2">
          {anomalies.map((a, i) => (
            <AnomalyRow key={i} a={a} domain={domain} />
          ))}
        </ul>
      )}
    </div>
  );
}
