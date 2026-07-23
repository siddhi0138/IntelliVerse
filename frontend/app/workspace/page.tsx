"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  checkUploadSize,
  confirmRelationships,
  createWorkspace,
  deleteWorkspace,
  fetchEntityProfile,
  fetchWorkspaceGraph,
  fetchWorkspaceMetadata,
  saveWorkspace,
} from "@/lib/api";
import type {
  EntityProfile,
  GraphAnalytics,
  RelationshipCandidate,
  WorkspaceGraph,
  WorkspaceTable,
} from "@/lib/types";
import { RelationshipReviewPanel } from "@/components/RelationshipReviewPanel";
import { WorkspaceGraphExplorer } from "@/components/WorkspaceGraphExplorer";
import { GraphAnalyticsPanel } from "@/components/GraphAnalyticsPanel";
import { EntityProfilePanel } from "@/components/EntityProfilePanel";
import { EntityImpactPanel } from "@/components/EntityImpactPanel";

interface GraphSummary {
  node_count: number;
  edge_count: number;
  analytics: GraphAnalytics;
}

export default function WorkspacePage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [tables, setTables] = useState<WorkspaceTable[]>([]);
  const [suggestedRelationships, setSuggestedRelationships] = useState<RelationshipCandidate[]>([]);
  const [confirmedIdx, setConfirmedIdx] = useState<Set<number>>(new Set());

  const [restoring, setRestoring] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [graphResult, setGraphResult] = useState<GraphSummary | null>(null);
  const [graph, setGraph] = useState<WorkspaceGraph | null>(null);
  const [entityProfile, setEntityProfile] = useState<EntityProfile | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const resetView = useCallback(() => {
    setWorkspaceId(null);
    setTables([]);
    setSuggestedRelationships([]);
    setConfirmedIdx(new Set());
    setGraphResult(null);
    setGraph(null);
    setEntityProfile(null);
    setSavedAt(null);
    localStorage.removeItem("nexus_last_workspace");
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Only a workspace whose graph was actually confirmed is worth
    // restoring — the pre-confirm relationship review step depends on the
    // raw uploaded tables, which are never persisted, so there's nothing
    // to rebuild for that in-between state.
    async function restore() {
      const savedId = localStorage.getItem("nexus_last_workspace");
      if (!savedId) {
        if (!cancelled) setRestoring(false);
        return;
      }
      try {
        const [metadata, g] = await Promise.all([fetchWorkspaceMetadata(savedId), fetchWorkspaceGraph(savedId)]);
        if (cancelled) return;
        setWorkspaceId(savedId);
        setTables(metadata.tables);
        if (metadata.analytics) {
          setGraphResult({ node_count: metadata.node_count, edge_count: metadata.edge_count, analytics: metadata.analytics });
        }
        setGraph(g);
        setSavedAt(metadata.saved_at);
      } catch {
        localStorage.removeItem("nexus_last_workspace");
      } finally {
        if (!cancelled) setRestoring(false);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== "nexus_workspace_deleted" || !e.newValue) return;
      if (e.newValue === workspaceId) resetView();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [workspaceId, resetView]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const sizeError = checkUploadSize(file);
      if (sizeError) {
        setError(sizeError);
        return;
      }
    }
    setUploading(true);
    setError(null);
    resetView();
    try {
      const result = await createWorkspace(Array.from(files));
      setWorkspaceId(result.workspace_id);
      setTables(result.tables);
      setSuggestedRelationships(result.suggested_relationships);
      setConfirmedIdx(new Set(result.suggested_relationships.map((_, i) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create workspace.");
    } finally {
      setUploading(false);
    }
  }

  function toggleRelationship(index: number) {
    setConfirmedIdx((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleBuildGraph() {
    if (!workspaceId) return;
    setBuilding(true);
    setError(null);
    try {
      const relationships = suggestedRelationships.filter((_, i) => confirmedIdx.has(i));
      const result = await confirmRelationships(workspaceId, relationships);
      setGraphResult(result);
      const g = await fetchWorkspaceGraph(workspaceId);
      setGraph(g);
      localStorage.setItem("nexus_last_workspace", workspaceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the knowledge graph.");
    } finally {
      setBuilding(false);
    }
  }

  async function handleSave() {
    if (!workspaceId) return;
    setSaving(true);
    setError(null);
    try {
      const timestamp = await saveWorkspace(workspaceId);
      setSavedAt(timestamp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this workspace.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveWorkspace() {
    if (!workspaceId) return;
    if (!window.confirm("Permanently delete this workspace's knowledge graph? This can't be undone.")) return;
    setRemoving(true);
    setError(null);
    try {
      await deleteWorkspace(workspaceId);
      localStorage.setItem("nexus_workspace_deleted", workspaceId);
      resetView();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove this workspace.");
    } finally {
      setRemoving(false);
    }
  }

  async function handleNodeClick(table: string, key: string) {
    if (!workspaceId) return;
    try {
      const profile = await fetchEntityProfile(workspaceId, table, key);
      setEntityProfile(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load entity profile.");
    }
  }

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">🕸️ Multi-table Workspace</h1>
          <p className="text-slate-500 mt-1 text-sm max-w-2xl">
            Upload related tables — IntelliVerse finds how they connect and builds a knowledge graph in Neo4j.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full px-3 py-1.5 whitespace-nowrap"
        >
          &larr; Single dataset
        </Link>
      </header>

      {restoring && <p className="text-sm text-slate-500">Restoring your last workspace…</p>}

      {!restoring && !workspaceId && (
        <div
          onClick={() => inputRef.current?.click()}
          className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-indigo-400 p-12 text-center cursor-pointer transition-colors"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.json"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <p className="text-slate-600 dark:text-slate-400">
            {uploading ? "Analyzing tables…" : "Click to select multiple related files (e.g. Sales.csv, Customers.csv, Products.csv)"}
          </p>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {workspaceId && (
        <div className="mt-2 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {tables.map((t) => (
                <span key={t.table} className="badge">
                  {t.table} ({t.row_count.toLocaleString()} rows)
                </span>
              ))}
            </div>
            <button
              onClick={handleRemoveWorkspace}
              disabled={removing}
              title="Remove this workspace permanently"
              aria-label="Remove this workspace"
              className="rounded-full border border-slate-300 dark:border-slate-800 w-7 h-7 flex items-center justify-center text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:border-red-400 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              ✕
            </button>
          </div>

          {!graphResult && (
            <>
              <RelationshipReviewPanel
                candidates={suggestedRelationships}
                confirmed={confirmedIdx}
                onToggle={toggleRelationship}
              />

              <button onClick={handleBuildGraph} disabled={building} className="btn-primary py-2 px-5">
                {building ? "Building knowledge graph…" : "Build Knowledge Graph"}
              </button>
            </>
          )}

          {graphResult && graph && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  {graphResult.node_count} entities, {graphResult.edge_count} relationships ingested into Neo4j.
                </p>
                <div className="flex items-center gap-3">
                  {savedAt && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      ✓ Saved at {new Date(savedAt).toLocaleTimeString()}
                    </span>
                  )}
                  <button onClick={handleSave} disabled={saving} className="btn-secondary">
                    {saving ? "Saving…" : "💾 Save workspace"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <WorkspaceGraphExplorer graph={graph} onNodeClick={handleNodeClick} />
                </div>
                <EntityProfilePanel profile={entityProfile} onNavigate={handleNodeClick} />
              </div>

              {entityProfile && (
                <EntityImpactPanel workspaceId={workspaceId} table={entityProfile.table} entityKey={entityProfile.key} />
              )}

              <GraphAnalyticsPanel analytics={graphResult.analytics} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
