"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, Target } from "lucide-react";
import {
  deleteSavedOptimization,
  fetchLastOptimization,
  listSavedOptimizations,
  optimizeScenario,
  saveOptimization,
} from "@/lib/api";
import type { DecisionAction, OptimizationResult, SavedOptimization } from "@/lib/types";
import type { ConfidenceLevel } from "@/lib/plainLanguage";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { Panel, Badge, ProgressBar } from "./ui";
import { PALETTE } from "./charts";
import { usePersona } from "./PersonaContext";
import { useSimpleMode } from "./SimpleModeContext";

function confidenceLevel(rSquared: number): ConfidenceLevel {
  if (rSquared >= 0.5) return "high";
  if (rSquared >= 0.2) return "medium";
  return "low";
}

export function OptimizationPanel({
  analysisId,
  domain,
  decisions,
  primaryMetric,
}: {
  analysisId: string;
  domain: string;
  decisions: DecisionAction[];
  primaryMetric: string | null;
}) {
  const [targetColumn, setTargetColumn] = useState(primaryMetric ?? decisions[0]?.column ?? "");
  const [selectedLevers, setSelectedLevers] = useState<Set<string>>(
    new Set(decisions.map((d) => d.column).filter((c) => c !== (primaryMetric ?? decisions[0]?.column)))
  );
  const [budgetPct, setBudgetPct] = useState<number | null>(null);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saved, setSaved] = useState<SavedOptimization[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { persona } = usePersona();
  const { simpleMode } = useSimpleMode();

  const refreshSaved = useCallback(() => {
    listSavedOptimizations(analysisId)
      .then(setSaved)
      .catch(() => {});
  }, [analysisId]);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  // Restores whatever plan the user last computed for this dataset — the
  // combinatorial search + AI narration is expensive enough that losing it
  // on every refresh (the previous behavior) was a real complaint, not just
  // a nice-to-have.
  useEffect(() => {
    let cancelled = false;
    fetchLastOptimization(analysisId)
      .then((last) => {
        if (cancelled || !last) return;
        setResult(last);
        setTargetColumn(last.target_column);
        setSelectedLevers(new Set(last.best.levers.map((l) => l.column)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  function toggleLever(column: string) {
    setSelectedLevers((prev) => {
      const next = new Set(prev);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  }

  async function run() {
    const levers = Array.from(selectedLevers).filter((c) => c !== targetColumn);
    if (levers.length === 0) {
      setError("Pick at least one lever different from the goal metric.");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await optimizeScenario(analysisId, domain, targetColumn, levers, budgetPct, persona, simpleMode);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find a plan.");
    } finally {
      setRunning(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    const label = window.prompt("Label this saved plan:", result.target_label);
    if (!label) return;
    setSaving(true);
    try {
      await saveOptimization(analysisId, label, result, persona);
      refreshSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(savedId: string) {
    if (!window.confirm("Delete this saved plan? This can't be undone.")) return;
    setDeletingId(savedId);
    try {
      await deleteSavedOptimization(analysisId, savedId);
      refreshSaved();
    } finally {
      setDeletingId(null);
    }
  }

  if (decisions.length < 2) {
    return null;
  }

  return (
    <Panel
      title="Find the best plan"
      subtitle="Search combinations of multiple levers at once for the one that best moves your goal — not just one change at a time."
      actions={<Badge tone="brand"><Target className="h-3 w-3" /> Optimizer</Badge>}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-muted mb-1.5">Goal: maximize</label>
          <select
            value={targetColumn}
            onChange={(e) => setTargetColumn(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface text-foreground px-3 py-1.5 text-sm"
          >
            {decisions.map((d) => (
              <option key={d.id} value={d.column} className="bg-surface text-foreground">
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-muted mb-1.5">
            Levers to adjust
          </label>
          <div className="flex flex-wrap gap-2">
            {decisions
              .filter((d) => d.column !== targetColumn)
              .map((d) => (
                <button
                  key={d.id}
                  onClick={() => toggleLever(d.column)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                    selectedLevers.has(d.column)
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted hover:text-foreground"
                  }`}
                >
                  {d.label}
                </button>
              ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-foreground/80">
            <input
              type="checkbox"
              checked={budgetPct !== null}
              onChange={(e) => setBudgetPct(e.target.checked ? 50 : null)}
              className="accent-primary"
            />
            Limit total change budget
          </label>
          {budgetPct !== null && (
            <>
              <input
                type="range"
                min={5}
                max={100}
                value={budgetPct}
                onChange={(e) => setBudgetPct(Number(e.target.value))}
                className="w-40"
              />
              <span className="text-sm font-medium w-16">{budgetPct}%</span>
            </>
          )}
        </div>

        <button onClick={run} disabled={running} className="btn-primary">
          {running ? `Searching thousands of combinations…` : "Find best plan"}
        </button>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {result && (
          <div className="space-y-4 pt-2">
            <div className="rounded-xl border border-border bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Projected {result.target_label}</p>
                  <p className="font-display text-2xl font-bold text-foreground">
                    {result.best.projected_target.toLocaleString()}
                    {result.best.delta_pct !== null && (
                      <span className={`ml-2 text-sm font-semibold ${result.best.delta_pct >= 0 ? "text-accent" : "text-red-400"}`}>
                        {result.best.delta_pct >= 0 ? "+" : ""}
                        {result.best.delta_pct}%
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    vs. baseline {result.baseline_target.toLocaleString()} · {result.samples_tried.toLocaleString()} combinations tried
                  </p>
                </div>
                <ConfidenceBadge level={confidenceLevel(result.r_squared)} />
              </div>

              <div className="space-y-2.5 mt-3">
                {result.best.levers.map((lever, i) => (
                  <div key={lever.column}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground/80">{lever.semantic_label}</span>
                      <span className="font-mono text-xs font-semibold" style={{ color: PALETTE[i % PALETTE.length] }}>
                        {lever.pct_change >= 0 ? "+" : ""}
                        {lever.pct_change}%
                      </span>
                    </div>
                    <ProgressBar
                      value={Math.abs(lever.pct_change)}
                      max={30}
                      className="mt-1"
                      hexColor={PALETTE[i % PALETTE.length]}
                    />
                  </div>
                ))}
              </div>
            </div>

            {result.explanation && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-2">
                <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                <p className="text-sm text-foreground">{result.explanation}</p>
              </div>
            )}

            {result.runners_up.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-xs font-medium text-muted hover:text-foreground">
                  Show {result.runners_up.length} runner-up combinations tried
                </summary>
                <ul className="mt-2 space-y-2">
                  {result.runners_up.map((c, i) => (
                    <li key={i} className="text-xs text-muted rounded-lg border border-border/60 p-2.5">
                      {c.levers.map((l) => `${l.semantic_label} ${l.pct_change >= 0 ? "+" : ""}${l.pct_change}%`).join(", ")}
                      {" → "}
                      <span className="text-foreground/80">
                        {c.projected_target.toLocaleString()}
                        {c.delta_pct !== null && ` (${c.delta_pct >= 0 ? "+" : ""}${c.delta_pct}%)`}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <p className="text-xs text-muted">{result.note}</p>

            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save this plan"}
            </button>
          </div>
        )}

        {saved.length > 0 && (
          <div className="rounded-xl border border-border bg-white/[0.02] p-4">
            <h4 className="text-sm font-semibold text-foreground mb-2">Saved plans</h4>
            <ul className="space-y-1">
              {saved.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span>
                    {s.label}{" "}
                    <span className="text-muted text-xs">
                      ({new Date(s.saved_at).toLocaleString()}{s.persona ? ` · viewed as ${s.persona}` : ""})
                    </span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => {
                        setResult(s.result);
                        setTargetColumn(s.result.target_column);
                        setSelectedLevers(new Set(s.result.best.levers.map((l) => l.column)));
                      }}
                      className="text-primary hover:underline text-xs"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      disabled={deletingId === s.id}
                      className="btn-danger-ghost disabled:opacity-50"
                    >
                      {deletingId === s.id ? "Deleting…" : "Delete"}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
