"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Database,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  GitBranch,
  Workflow,
  Target,
  ListChecks,
  MessageSquareText,
  Upload,
  Activity,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Hash,
  Calendar,
  FileText,
  Home as HomeIcon,
  Compass,
  History,
  Terminal,
  RefreshCw,
} from "lucide-react";
import { analyzeFileWithProgress, checkUploadSize, deleteDataset, fetchCatalogDataset, refreshAnalysis } from "@/lib/api";
import { userScopedKey } from "@/lib/auth";
import type { AnalyzeResponse, ColumnType } from "@/lib/types";
import { ChartCard, ChartBody, PALETTE } from "@/components/charts";
import { Panel, StatCard, Badge, ProgressBar } from "@/components/ui";
import { SchemaTable } from "@/components/SchemaTable";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { KnowledgeGraph3D } from "@/components/KnowledgeGraph3D";
import { ForecastSection } from "@/components/ForecastSection";
import { AnomaliesPanel } from "@/components/AnomaliesPanel";
import { DecisionSimulator } from "@/components/DecisionSimulator";
import { OptimizationPanel } from "@/components/OptimizationPanel";
import { LiveStreamPanel } from "@/components/LiveStreamPanel";
import { ModelLearningPanel } from "@/components/ModelLearningPanel";
import { DataQualityPanel } from "@/components/DataQualityPanel";
import { RelationshipsPanel } from "@/components/RelationshipsPanel";
import { RootCausePanel } from "@/components/RootCausePanel";
import { RiskAlertsPanel } from "@/components/RiskAlertsPanel";
import { AskIntelliVerse } from "@/components/AskIntelliVerse";
import { DatasetSummaryPanel } from "@/components/DatasetSummaryPanel";
import { RankedFindingsPanel } from "@/components/RankedFindingsPanel";
import { InsightTimelinePanel } from "@/components/InsightTimelinePanel";
import { MultivariateAnomaliesPanel } from "@/components/MultivariateAnomaliesPanel";
import { DistributionPanel } from "@/components/DistributionPanel";
import { ClusteringPanel } from "@/components/ClusteringPanel";
import { GEValidationPanel } from "@/components/GEValidationPanel";
import { ActionPlanPanel } from "@/components/ActionPlanPanel";
import { SqlQueryPanel } from "@/components/SqlQueryPanel";
import { ReportExportPanel } from "@/components/ReportExportPanel";
import { QuickSummaryPanel } from "@/components/QuickSummaryPanel";
import { BusinessHealthPanel } from "@/components/BusinessHealthPanel";
import { GuidedTour, hasSeenTour, type TabId } from "@/components/GuidedTour";
import { PersonaSelector } from "@/components/PersonaSelector";
import { useSimpleMode } from "@/components/SimpleModeContext";

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "schema", label: "Schema", icon: Database },
  { id: "stats", label: "Statistics", icon: BarChart3 },
  { id: "forecast", label: "Forecast", icon: TrendingUp },
  { id: "anomalies", label: "Anomalies", icon: AlertTriangle },
  { id: "rootcause", label: "Root cause", icon: GitBranch },
  { id: "graph", label: "Knowledge graph", icon: Workflow },
  { id: "simulation", label: "Simulation", icon: Target },
  { id: "action", label: "Action plan", icon: ListChecks },
  { id: "ask", label: "Ask IntelliVerse", icon: MessageSquareText },
  { id: "sql", label: "SQL Query", icon: Terminal },
];

// Matches the reference workspace shell's grouping (Analyze / Investigate /
// Decide) — same three buckets, same tab order within each. SQL query gets
// its own tab in Decide rather than being bundled inside Ask IntelliVerse —
// ad-hoc SQL is a distinct power-user tool, not a follow-up to chat.
const TAB_GROUPS: { title: string; ids: TabId[] }[] = [
  { title: "Analyze", ids: ["overview", "schema", "stats"] },
  { title: "Investigate", ids: ["forecast", "anomalies", "rootcause"] },
  { title: "Decide", ids: ["graph", "simulation", "action", "ask", "sql"] },
];

// Cycled by index — our KPIs are domain-agnostic (no fixed metric-to-icon
// mapping like the reference's Revenue/Units/Anomalies/Confidence).
const KPI_ICONS = [Activity, TrendingUp, Layers, Sparkles];

// Buckets our 6 inferred column types into the reference's 4 schema tiles.
const SCHEMA_TYPE_TILES: { label: string; types: ColumnType[]; icon: typeof Hash; color: string }[] = [
  { label: "Numeric", types: ["numeric"], icon: Hash, color: "text-primary" },
  { label: "Categorical", types: ["categorical"], icon: Layers, color: "text-accent" },
  { label: "Datetime", types: ["date"], icon: Calendar, color: "text-amber-400" },
  { label: "Text / Other", types: ["id", "boolean", "text"], icon: FileText, color: "text-muted" },
];

export default function Home() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [graphView, setGraphView] = useState<"2d" | "3d">("2d");
  const [tourActive, setTourActive] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [lastDataset, setLastDataset] = useState<{ id: string; filename: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { simpleMode, setSimpleMode } = useSimpleMode();

  const inputRef = useRef<HTMLInputElement>(null);

  // Shared by the auto-reopen effect below and the homepage's "Resume"
  // button, so both paths open a dataset the exact same way.
  const openDataset = useCallback((reopenId: string) => {
    fetchCatalogDataset(reopenId)
      .then((detail) => {
        if (detail.result) {
          setResult(detail.result);
          window.history.replaceState(null, "", `/?reopen=${reopenId}`);
          localStorage.setItem(userScopedKey("nexus_last_analysis"), reopenId);
          localStorage.setItem(userScopedKey("nexus_last_filename"), detail.filename);
        } else {
          setError("This dataset's full result wasn't saved (uploaded before this feature existed).");
        }
      })
      .catch((err) => {
        // A 404 here almost always means a stale pointer (e.g. the URL's
        // ?reopen= is a stale bookmark, or the dataset was deleted) rather
        // than something the user needs to see — clear it and fall back to
        // the clean landing page instead of surfacing a raw catalog error.
        const message = err instanceof Error ? err.message : "Could not reopen this dataset.";
        if (message.includes("not found")) {
          localStorage.removeItem(userScopedKey("nexus_last_analysis"));
          localStorage.removeItem(userScopedKey("nexus_last_filename"));
          window.history.replaceState(null, "", "/");
          setLastDataset(null);
          return;
        }
        setError(message);
      });
  }, []);

  useEffect(() => {
    // The URL's ?reopen= wins if present (a direct link or a fresh upload's
    // replaceState below). Otherwise fall back to the last-viewed analysis
    // in localStorage — this is what actually kept losing state: any nav
    // link back to plain "/" (from /catalog, /workspace, /knowledge) has no
    // query param at all, so the URL alone wasn't enough to survive normal
    // in-app navigation, only a same-page reload.
    const reopenId = new URLSearchParams(window.location.search).get("reopen") ?? localStorage.getItem(userScopedKey("nexus_last_analysis"));
    if (reopenId) openDataset(reopenId);
  }, [openDataset]);

  // Lets the homepage offer a one-click way back into the last dataset —
  // going Home (below) intentionally no longer erases this pointer, it only
  // clears the in-memory view, so there's always a way back without
  // re-uploading the file.
  useEffect(() => {
    if (result) return;
    const id = localStorage.getItem(userScopedKey("nexus_last_analysis"));
    const filename = localStorage.getItem(userScopedKey("nexus_last_filename"));
    // Hydration-safe read of localStorage after mount (same pattern as PersonaContext).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastDataset(id && filename ? { id, filename } : null);
  }, [result]);

  const handleFile = useCallback(async (file: File) => {
    const sizeError = checkUploadSize(file);
    if (sizeError) {
      setError(sizeError);
      return;
    }
    setLoading(true);
    setProgressStep(null);
    setError(null);
    setResult(null);
    try {
      const data = await analyzeFileWithProgress(file, setProgressStep);
      setResult(data);
      setActiveTab("overview");
      // Reflect the analysis in both the URL (so a refresh or shared link
      // reopens the same dataset) and localStorage (so plain in-app
      // navigation back to "/" — the actual bug — doesn't lose it either).
      window.history.replaceState(null, "", `/?reopen=${data.analysis_id}`);
      localStorage.setItem(userScopedKey("nexus_last_analysis"), data.analysis_id);
      localStorage.setItem(userScopedKey("nexus_last_filename"), data.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
      setProgressStep(null);
    }
  }, []);

  // Leaving the dataset view (Home / the sidebar logo) only clears what's
  // on screen — it deliberately does NOT forget the dataset itself, so
  // there's always a way back in without re-uploading the file. Only an
  // actual delete (below) erases the pointer.
  const resetView = useCallback(() => {
    setResult(null);
    setError(null);
    window.history.replaceState(null, "", "/");
  }, []);

  const forgetLastDataset = useCallback(() => {
    localStorage.removeItem(userScopedKey("nexus_last_analysis"));
    localStorage.removeItem(userScopedKey("nexus_last_filename"));
    setLastDataset(null);
  }, []);

  const handleDeleteDataset = useCallback(async () => {
    if (!result) return;
    if (!window.confirm(`Permanently delete "${result.filename}"? This can't be undone.`)) return;
    const analysisId = result.analysis_id;
    try {
      await deleteDataset(analysisId);
      resetView();
      forgetLastDataset();
      // Storage events only fire in *other* tabs, not this one — exactly
      // what we want, since this tab already reset itself above. Any other
      // tab showing this same analysis_id picks this up and clears too.
      localStorage.setItem("nexus_dataset_deleted", analysisId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this dataset.");
    }
  }, [result, resetView, forgetLastDataset]);

  const handleRefreshAnalysis = useCallback(async () => {
    if (!result) return;
    setRefreshing(true);
    setError(null);
    try {
      const updated = await refreshAnalysis(result.analysis_id);
      setResult(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh the analysis.");
    } finally {
      setRefreshing(false);
    }
  }, [result]);

  useEffect(() => {
    // The sidebar's own IntelliVerse logo also links to "/" — but Next's
    // router won't remount this page for a Link to the route it's already
    // on, so that click did nothing while a dataset was open. This event
    // (dispatched from Sidebar.tsx) is what actually clears the view.
    window.addEventListener("intelliverse:go-home", resetView);
    return () => window.removeEventListener("intelliverse:go-home", resetView);
  }, [resetView]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== "nexus_dataset_deleted" || !e.newValue) return;
      if (e.newValue === "ALL" || e.newValue === result?.analysis_id) {
        resetView();
      }
      if (e.newValue === "ALL" || e.newValue === lastDataset?.id) {
        forgetLastDataset();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [result, resetView, lastDataset, forgetLastDataset]);

  useEffect(() => {
    if (!result || hasSeenTour()) return;
    const t = window.setTimeout(() => setTourActive(true), 600);
    return () => window.clearTimeout(t);
  }, [result]);

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  if (!result) {
    return (
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 sm:px-6 sm:py-12">
        <div className="relative mb-8 border border-border bg-surface grid-bg rounded-3xl p-8 md:p-10 overflow-hidden">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-surface-elevated px-3 py-1 font-mono text-xs text-primary mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
            v1.0 — autonomous data intelligence
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-extrabold leading-[1.05] tracking-tight mb-6">
            Upload <span className="text-primary">anything</span>.<br />
            Understand everything.
          </h1>
          <p className="text-lg text-muted max-w-xl mb-8">
            Drop a file below and get a full analysis in seconds — schema, risks, forecasts, and a plain-English action plan.
          </p>
          <div className="flex flex-wrap gap-4">
            <button onClick={() => inputRef.current?.click()} className="btn-primary px-6 py-3 text-base">
              Browse files
            </button>
            <button onClick={() => setTourActive(true)} className="btn-secondary px-6 py-3 text-base">
              See how it works
            </button>
          </div>
        </div>

        {/* Primary call-to-action comes right after the pitch — Resume and
            Preferences below are both secondary (returning-user shortcut,
            display tuning), so they no longer sit between the hero and the
            one thing every first-time visitor is actually here to do. */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`glow-click relative overflow-hidden rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
            dragActive
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/60 hover:bg-surface/60"
          }`}
        >
          {dragActive && (
            <div className="absolute -inset-10 bg-accent-gradient opacity-20 blur-3xl animate-pulse-glow pointer-events-none" />
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          {!loading && (
            <Upload className="relative mx-auto mb-3 w-8 h-8 text-muted" strokeWidth={1.5} />
          )}
          <p className="relative text-muted">
            {loading
              ? progressStep ?? "Analyzing…"
              : "Drop a CSV, Excel, or JSON file here, or click to browse"}
          </p>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {lastDataset && (
          <button
            onClick={() => openDataset(lastDataset.id)}
            className="card mt-6 w-full flex items-center justify-between gap-3 p-4 text-left group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20">
                <History className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">Continue with {lastDataset.filename}</p>
                <p className="text-xs text-muted">Pick up where you left off — no re-upload needed</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-accent shrink-0 group-hover:translate-x-0.5 transition-transform">
              Resume →
            </span>
          </button>
        )}

        <div className="mt-6 card px-4 py-2.5 flex items-center gap-4 flex-wrap">
          <span className="text-xs font-medium uppercase tracking-wide text-muted shrink-0">Preferences</span>
          <div className="flex items-center gap-2 flex-wrap">
            <PersonaSelector />
            <button
              onClick={() => setSimpleMode(!simpleMode)}
              title={simpleMode ? "Switch to Expert Mode — show all the numbers by default" : "Switch to Simple Mode — hide the numbers by default"}
              className="text-sm font-medium text-muted hover:text-primary bg-background hover:bg-surface-elevated rounded-full px-3 py-1.5 border border-border"
            >
              {simpleMode ? "Simple Mode" : "Expert Mode"}
            </button>
          </div>
        </div>

        <GuidedTour active={tourActive} onClose={() => setTourActive(false)} activeTab={activeTab} onNavigate={setActiveTab} />
      </main>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky bar holds only real in-page navigation (the tabs) — no
            dataset name/badge here, that was reading as part of the
            navbar. Dataset identity + actions now live inside the
            scrollable content instead, as an ordinary card. */}
        <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
          {/* Left edge lines up with the content below (same px-4 sm:px-6),
              but this row itself spans the full width rather than being
              capped at max-w-7xl. Labels collapse to icon-only (with a
              hover/long-press tooltip via `title`) at every width up to
              very large desktop monitors — 11 tabs' full labels at a normal
              text size didn't reliably fit even at the low end of the 2xl
              breakpoint's own range (a 1536px-wide window is "2xl" but only
              ~1250px of that is left after the sidebar), so the label text
              stays at the smallest size and padding stays tight instead of
              growing at 2xl, to actually fit rather than just mostly fit.
              Even icon-only, 11 tabs clip a few px past 375px-wide phones,
              so overflow-x-auto is a scroll fallback rather than the
              primary layout mechanism. */}
          <div className="flex items-center justify-start gap-3 px-2 sm:px-4 lg:px-6 py-2 overflow-x-auto scrollbar-hide">
            {TAB_GROUPS.map((group) => (
              <div key={group.title} className="flex items-center gap-0.5">
                {group.ids.map((id) => {
                  const tab = TABS.find((t) => t.id === id)!;
                  const isActive = activeTab === id;
                  return (
                    <button
                      key={id}
                      data-tab={id}
                      title={tab.label}
                      onClick={() => setActiveTab(id)}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1.5 sm:py-2 text-xs font-medium transition-all ${
                        isActive ? "bg-primary/10 text-foreground ring-1 ring-primary/20" : "text-muted hover:bg-surface hover:text-foreground"
                      }`}
                    >
                      <tab.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                      <span className="hidden 2xl:inline whitespace-nowrap">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto max-w-7xl w-full mx-auto px-4 py-8 sm:px-6 sm:py-12">
          {/* Same container width/padding as every other page (catalog,
              workspace, knowledge, the pre-upload homepage) — this was the
              one page rendering edge-to-edge instead of matching their
              centered max-w-7xl, which read as inconsistent margins. */}
          <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={resetView}
                title="Back to homepage"
                aria-label="Back to homepage"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"
              >
                <HomeIcon className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{result.filename}</p>
                <p className="truncate text-xs text-muted">
                  {result.row_count.toLocaleString()} rows · {result.column_count} cols
                </p>
              </div>
              <span className="badge shrink-0">{result.domain}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleRefreshAnalysis}
                disabled={refreshing}
                title="Re-run the full analysis against the dataset's current data — picks up any rows a live stream has appended, which the dashboard otherwise doesn't do automatically"
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold text-primary-foreground bg-accent-gradient glow-ring hover:brightness-110 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing…" : "Refresh analysis"}
              </button>
              <button
                onClick={() => setTourActive(true)}
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold text-primary-foreground bg-accent-gradient glow-ring hover:brightness-110 hover:-translate-y-0.5 transition-all"
              >
                <Compass className="h-3.5 w-3.5" /> Take a tour
              </button>
              <button
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold text-primary-foreground bg-accent-gradient glow-ring hover:brightness-110 hover:-translate-y-0.5 transition-all"
              >
                <Upload className="h-3.5 w-3.5" /> New upload
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <button
                onClick={handleDeleteDataset}
                title="Delete this dataset permanently"
                aria-label="Delete this dataset"
                className="rounded-full border border-border w-9 h-9 flex items-center justify-center text-muted hover:text-red-600 dark:hover:text-red-400 hover:border-red-400 transition-colors shrink-0"
              >
                ✕
              </button>
            </div>
          </div>

          {error && (
            <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {activeTab === "overview" && (() => {
            const kpiItems = result.charts.filter((c) => c.chart_type === "kpi").flatMap((c) => c.data);
            const mainChart =
              result.charts.find((c) => c.chart_type === "line") ??
              result.charts.find((c) => c.chart_type === "bar");
            const rootDims = result.root_cause?.dimensions ?? [];
            return (
              <div className="space-y-5">
                <div data-tour="quick-summary">
                  <QuickSummaryPanel result={result} />
                </div>

                <LiveStreamPanel analysisId={result.analysis_id} primaryMetric={result.primary_metric} />

                {kpiItems.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {kpiItems.map((item, i) => {
                      const Icon = KPI_ICONS[i % KPI_ICONS.length];
                      return (
                        <StatCard
                          key={i}
                          label={String(item.label)}
                          value={typeof item.value === "number" ? item.value.toLocaleString() : String(item.value)}
                          icon={<Icon className="h-5 w-5" />}
                          accentColor={PALETTE[i % PALETTE.length]}
                        />
                      );
                    })}
                  </div>
                )}

                <div className="grid gap-5 lg:grid-cols-3">
                  {mainChart && (
                    <Panel className="lg:col-span-2" title={mainChart.title} subtitle="Computed directly from your data">
                      <ChartBody chart={mainChart} />
                    </Panel>
                  )}
                  {result.business_health && (
                    <div data-tour="health-score" className={mainChart ? "" : "lg:col-span-3"}>
                      <BusinessHealthPanel health={result.business_health} />
                    </div>
                  )}
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <Panel
                    title="Top anomalies"
                    subtitle="Detected spikes and drops"
                    actions={
                      result.anomalies.length > 0 ? (
                        <button onClick={() => setActiveTab("anomalies")} className="text-xs font-semibold text-primary hover:text-accent">
                          View all
                        </button>
                      ) : undefined
                    }
                  >
                    {result.anomalies.length === 0 ? (
                      <p className="text-sm text-muted">No anomalies detected in this dataset.</p>
                    ) : (
                      <div className="space-y-2">
                        {result.anomalies.slice(0, 3).map((a, i) => (
                          <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-white/[0.02] p-3">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                a.direction === "above" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                              }`}
                            >
                              {a.direction === "above" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{a.semantic_label}</p>
                              <p className="text-xs text-muted">row {a.row}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-foreground">{a.value.toLocaleString()}</p>
                              <Badge tone={a.direction === "above" ? "bad" : "warn"}>{a.direction}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Panel>

                  <Panel
                    title="Root-cause drivers"
                    subtitle="Top contributing factors"
                    actions={
                      rootDims.length > 0 ? (
                        <button onClick={() => setActiveTab("rootcause")} className="text-xs font-semibold text-primary hover:text-accent">
                          View all
                        </button>
                      ) : undefined
                    }
                  >
                    {rootDims.length === 0 ? (
                      <p className="text-sm text-muted">No dominant driver was found for this dataset&apos;s primary metric.</p>
                    ) : (
                      <div className="space-y-3">
                        {rootDims.slice(0, 4).map((d, i) => (
                          <div key={d.dimension_column}>
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs text-foreground/80">{d.dimension_label}</span>
                              <span className="text-xs font-semibold" style={{ color: PALETTE[i % PALETTE.length] }}>
                                {d.variance_explained_pct.toFixed(1)}%
                              </span>
                            </div>
                            <ProgressBar value={d.variance_explained_pct} max={100} className="mt-1.5" hexColor={PALETTE[i % PALETTE.length]} />
                          </div>
                        ))}
                      </div>
                    )}
                  </Panel>
                </div>

                <div data-tour="risk-alerts">
                  <RiskAlertsPanel alerts={result.risk_alerts} />
                </div>

                <div data-tour="export">
                  <ReportExportPanel key={`report-${result.analysis_id}`} analysisId={result.analysis_id} />
                </div>

                <InsightTimelinePanel timeline={result.insight_timeline} />
              </div>
            );
          })()}

          {activeTab === "schema" && (
            <div className="space-y-5">
              <div data-tour="summary">
                <DatasetSummaryPanel
                  analysisId={result.analysis_id}
                  domain={result.domain}
                  rowCount={result.row_count}
                  columnCount={result.column_count}
                  schema={result.schema}
                  quality={result.quality}
                />
              </div>

              <Panel title="Inferred schema" subtitle={`${result.column_count} columns · domain: ${result.domain}`}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {SCHEMA_TYPE_TILES.map((tile) => {
                    const count = result.schema.filter((c) => (tile.types as string[]).includes(c.type)).length;
                    return (
                      <div key={tile.label} className="rounded-xl border border-border bg-white/[0.02] p-4">
                        <tile.icon className={`h-5 w-5 ${tile.color}`} />
                        <p className="mt-2 font-display text-2xl font-bold text-foreground">{count}</p>
                        <p className="text-xs text-muted">{tile.label}</p>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <div data-tour="schema">
                <h3 className="text-base font-semibold text-foreground mb-3">Columns</h3>
                <SchemaTable key={result.analysis_id} schema={result.schema} analysisId={result.analysis_id} />
              </div>
            </div>
          )}

          {activeTab === "stats" && (
            <div data-tour="analysis-grid" className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {result.charts
                .filter((c) => c.chart_type !== "kpi")
                .map((chart) => (
                  <ChartCard key={chart.id} chart={chart} />
                ))}
              <DataQualityPanel quality={result.quality} />
              <DistributionPanel distributions={result.distributions} />
              <ClusteringPanel clustering={result.clustering} />
              <GEValidationPanel validation={result.ge_validation} />
            </div>
          )}

          {activeTab === "forecast" && (
            <div data-tour="forecast" className="space-y-6">
              <ForecastSection
                analysisId={result.analysis_id}
                domain={result.domain}
                initialForecast={result.forecast}
                eligibility={result.forecast_eligibility}
                targets={result.forecastable_targets}
                primaryMetric={result.primary_metric}
              />
              <ModelLearningPanel analysisId={result.analysis_id} targetColumn={result.primary_metric} />
            </div>
          )}

          {activeTab === "anomalies" && (
            <div className="space-y-6">
              <AnomaliesPanel anomalies={result.anomalies} domain={result.domain} />
              <MultivariateAnomaliesPanel anomalies={result.multivariate_anomalies} />
            </div>
          )}

          {activeTab === "rootcause" && (
            <div className="space-y-6">
              <div data-tour="findings">
                <RankedFindingsPanel findings={result.ranked_findings} />
              </div>
              <RootCausePanel rootCause={result.root_cause} />
              <RelationshipsPanel correlations={result.correlations} associations={result.associations} />
            </div>
          )}

          {activeTab === "graph" && (
            <div data-tour="graph">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-semibold text-foreground">Knowledge graph</h3>
                <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                  <button
                    onClick={() => setGraphView("2d")}
                    className={`px-3 py-1 ${graphView === "2d" ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"}`}
                  >
                    2D
                  </button>
                  <button
                    onClick={() => setGraphView("3d")}
                    className={`px-3 py-1 ${graphView === "3d" ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"}`}
                  >
                    3D
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted mb-3">
                How to read this: each dot (node) is a row in your data; lines connect rows that share a relationship.
                Bigger or more-connected dots matter more — drag to explore, scroll to zoom.
              </p>
              {graphView === "2d" ? <KnowledgeGraph graph={result.graph} /> : <KnowledgeGraph3D graph={result.graph} />}
            </div>
          )}

          {activeTab === "simulation" && (
            <div data-tour="simulator" className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-1">Decision Simulator</h3>
                <p className="text-sm text-muted mb-3">
                  Try a change and see its likely effect on your other numbers, based on patterns already in your data.
                </p>
                <DecisionSimulator
                  analysisId={result.analysis_id}
                  domain={result.domain}
                  decisions={result.decisions}
                  primaryMetric={result.primary_metric}
                />
              </div>

              <OptimizationPanel
                analysisId={result.analysis_id}
                domain={result.domain}
                decisions={result.decisions}
                primaryMetric={result.primary_metric}
              />
            </div>
          )}

          {activeTab === "action" && (
            <div data-tour="action-plan">
              <ActionPlanPanel
                key={`action-plan-${result.analysis_id}`}
                analysisId={result.analysis_id}
                domain={result.domain}
                rankedFindings={result.ranked_findings}
                riskAlerts={result.risk_alerts}
                rootCause={result.root_cause}
                forecast={result.forecast}
                quality={result.quality}
              />
            </div>
          )}

          {activeTab === "ask" && (
            <div data-tour="ask">
              <AskIntelliVerse analysisId={result.analysis_id} domain={result.domain} primaryMetric={result.primary_metric} />
            </div>
          )}

          {activeTab === "sql" && (
            <div data-tour="sql">
              <SqlQueryPanel key={`sql-${result.analysis_id}`} analysisId={result.analysis_id} />
            </div>
          )}
        </main>
      </div>

      <GuidedTour active={tourActive} onClose={() => setTourActive(false)} activeTab={activeTab} onNavigate={setActiveTab} />
    </div>
  );
}
