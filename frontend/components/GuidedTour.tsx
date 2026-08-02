"use client";

import { useCallback, useEffect, useState } from "react";
import { userScopedKey } from "@/lib/auth";

export type TabId =
  | "overview"
  | "schema"
  | "stats"
  | "forecast"
  | "anomalies"
  | "rootcause"
  | "graph"
  | "simulation"
  | "action"
  | "ask"
  | "sql";

interface TourStep {
  target: string;
  tab: TabId;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    target: "quick-summary",
    tab: "overview",
    title: "What you got, in plain terms",
    body: "Start here. A plain-language recap of the analysis — no AI needed, so it's always here and always accurate.",
  },
  {
    target: "health-score",
    tab: "overview",
    title: "Business Health",
    body: "One score for data quality, growth, forecast confidence, and risk — also computed directly, no AI.",
  },
  {
    target: "export",
    tab: "overview",
    title: "Export report",
    body: "Download this analysis as a PDF, Excel workbook, or PowerPoint deck — same findings, no re-computation.",
  },
  {
    target: "summary",
    tab: "schema",
    title: "Dataset summary",
    body: "IntelliVerse infers what your data is about — domain, schema, and a data-quality score — automatically, no setup.",
  },
  {
    target: "risk-alerts",
    tab: "overview",
    title: "Risk alerts",
    body: "Deterministic alerts, shown only when the forecast or root-cause analysis actually crosses a real threshold.",
  },
  {
    target: "ask",
    tab: "ask",
    title: "Ask IntelliVerse",
    body: "Ask a plain-English question about this dataset. Answers are grounded in the findings already computed below — never guessed.",
  },
  {
    target: "findings",
    tab: "rootcause",
    title: "Ranked findings",
    body: "Every correlation, association, and root cause this dataset contains, ranked by how much it actually matters.",
  },
  {
    target: "forecast",
    tab: "forecast",
    title: "Forecast",
    body: "Multiple models are backtested per target automatically; whichever has the lowest validation error is chosen for you.",
  },
  {
    target: "action-plan",
    tab: "action",
    title: "Action Plan",
    body: "Now that you've seen the findings, risk alerts, and forecast — here's the AI's take on what to do next, grounded in exactly that.",
  },
  {
    target: "analysis-grid",
    tab: "stats",
    title: "Deep-dive panels",
    body: "Anomalies, root cause, distributions, clustering, and data-quality checks all live here — open any card for detail.",
  },
  {
    target: "graph",
    tab: "graph",
    title: "Knowledge graph",
    body: "See how rows in your data relate to each other, in 2D or 3D — degree, centrality, and clusters, computed via NetworkX.",
  },
  {
    target: "simulator",
    tab: "simulation",
    title: "Decision simulator",
    body: "Pick a decision and see its estimated effect on other metrics, based on real associations found in this dataset.",
  },
  {
    target: "sql",
    tab: "sql",
    title: "SQL query",
    body: "Run ad-hoc SQL directly against this dataset via DuckDB — no separate database to set up.",
  },
  {
    target: "schema",
    tab: "schema",
    title: "Detected schema",
    body: "Every column's inferred type and meaning. If IntelliVerse got one wrong, click it here to correct it.",
  },
];

const SEEN_KEY = "nexus_tour_seen";

export function hasSeenTour(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(userScopedKey(SEEN_KEY)) === "1";
}

export function GuidedTour({
  active,
  onClose,
  activeTab,
  onNavigate,
}: {
  active: boolean;
  onClose: () => void;
  activeTab: TabId;
  onNavigate: (tab: TabId) => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Reset to the first step whenever the tour (re)opens. Adjusting state
  // during render — rather than in an effect — avoids the extra render
  // pass a `setState` inside `useEffect` would trigger.
  const [prevActive, setPrevActive] = useState(active);
  if (active !== prevActive) {
    setPrevActive(active);
    if (active) setStepIdx(0);
  }

  const measure = useCallback(() => {
    const el = document.querySelector(`[data-tour="${STEPS[stepIdx].target}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Always defer the setRect — including the "not found" case — so this
    // function never sets state synchronously when called from an effect.
    window.setTimeout(() => {
      const found = document.querySelector(`[data-tour="${STEPS[stepIdx].target}"]`);
      setRect(found ? found.getBoundingClientRect() : null);
    }, 300);
  }, [stepIdx]);

  // Each step lives on a specific tab; switch to it first (before the
  // target can even exist in the DOM to measure) whenever the step changes.
  useEffect(() => {
    if (!active) return;
    const wantedTab = STEPS[stepIdx].tab;
    if (wantedTab !== activeTab) {
      setRect(null);
      onNavigate(wantedTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIdx]);

  useEffect(() => {
    if (!active || STEPS[stepIdx].tab !== activeTab) return;
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, activeTab, stepIdx, measure]);

  if (!active) return null;

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  function finish() {
    localStorage.setItem(userScopedKey(SEEN_KEY), "1");
    onClose();
  }

  const pad = 8;
  const highlightStyle: React.CSSProperties = rect
    ? {
        position: "fixed",
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        borderRadius: 12,
        boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.65)",
        pointerEvents: "none",
        transition: "top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease",
        zIndex: 60,
      }
    : {
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.65)",
        zIndex: 60,
      };

  const tooltipWidth = 320;
  const tooltipTop = rect
    ? Math.min(rect.bottom + pad + 12, window.innerHeight - 200)
    : window.innerHeight / 2 - 80;
  const tooltipLeft = rect
    ? Math.min(Math.max(rect.left, 16), window.innerWidth - tooltipWidth - 16)
    : window.innerWidth / 2 - tooltipWidth / 2;

  return (
    <>
      <div style={highlightStyle} />
      <div
        style={{
          position: "fixed",
          top: tooltipTop,
          left: tooltipLeft,
          zIndex: 61,
          width: tooltipWidth,
          // The shared .card class is deliberately translucent (it sits on
          // the page's own background everywhere else) — here it floats
          // over the tour's dimmed overlay/spotlighted content instead, so
          // that transparency let whatever's behind it show through. This
          // needs a fully solid background regardless of what's underneath.
          background: "var(--surface-elevated)",
        }}
        className="rounded-2xl border border-border shadow-xl p-4"
      >
        <p className="text-xs text-muted mb-1">
          Step {stepIdx + 1} of {STEPS.length}
        </p>
        <h4 className="text-sm font-semibold text-foreground mb-1">{step.title}</h4>
        <p className="text-sm text-muted mb-4">{step.body}</p>
        <div className="flex items-center justify-between">
          <button
            onClick={finish}
            className="text-xs text-muted hover:text-foreground"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {stepIdx > 0 && (
              <button
                onClick={() => setStepIdx((i) => i - 1)}
                className="text-xs font-medium rounded-lg border border-border px-3 py-1.5 text-muted"
              >
                Back
              </button>
            )}
            <button onClick={() => (isLast ? finish() : setStepIdx((i) => i + 1))} className="btn-primary">
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
