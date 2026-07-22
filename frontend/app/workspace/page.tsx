"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  confirmRelationships,
  createWorkspace,
  fetchEntityProfile,
  fetchWorkspaceGraph,
} from "@/lib/api";
import type {
  ConfirmRelationshipsResponse,
  EntityProfile,
  WorkspaceGraph,
  WorkspaceResponse,
} from "@/lib/types";
import { RelationshipReviewPanel } from "@/components/RelationshipReviewPanel";
import { WorkspaceGraphExplorer } from "@/components/WorkspaceGraphExplorer";
import { GraphAnalyticsPanel } from "@/components/GraphAnalyticsPanel";
import { EntityProfilePanel } from "@/components/EntityProfilePanel";
import { EntityImpactPanel } from "@/components/EntityImpactPanel";

export default function WorkspacePage() {
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [confirmedIdx, setConfirmedIdx] = useState<Set<number>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [graphResult, setGraphResult] = useState<ConfirmRelationshipsResponse | null>(null);
  const [graph, setGraph] = useState<WorkspaceGraph | null>(null);
  const [entityProfile, setEntityProfile] = useState<EntityProfile | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    setWorkspace(null);
    setGraphResult(null);
    setGraph(null);
    setEntityProfile(null);
    try {
      const result = await createWorkspace(Array.from(files));
      setWorkspace(result);
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
    if (!workspace) return;
    setBuilding(true);
    setError(null);
    try {
      const relationships = workspace.suggested_relationships.filter((_, i) => confirmedIdx.has(i));
      const result = await confirmRelationships(workspace.workspace_id, relationships);
      setGraphResult(result);
      const g = await fetchWorkspaceGraph(workspace.workspace_id);
      setGraph(g);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the knowledge graph.");
    } finally {
      setBuilding(false);
    }
  }

  async function handleNodeClick(table: string, key: string) {
    if (!workspace) return;
    try {
      const profile = await fetchEntityProfile(workspace.workspace_id, table, key);
      setEntityProfile(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load entity profile.");
    }
  }

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">NEXUS Workspace</h1>
          <p className="text-slate-500 mt-1">Upload related tables. NEXUS finds how they connect.</p>
        </div>
        <Link href="/" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          &larr; Single dataset
        </Link>
      </header>

      <div
        onClick={() => inputRef.current?.click()}
        className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 p-12 text-center cursor-pointer transition-colors"
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

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {workspace && (
        <div className="mt-10 space-y-6">
          <div className="flex flex-wrap gap-2">
            {workspace.tables.map((t) => (
              <span
                key={t.table}
                className="px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-sm font-medium"
              >
                {t.table} ({t.row_count.toLocaleString()} rows)
              </span>
            ))}
          </div>

          <RelationshipReviewPanel
            candidates={workspace.suggested_relationships}
            confirmed={confirmedIdx}
            onToggle={toggleRelationship}
          />

          <button
            onClick={handleBuildGraph}
            disabled={building}
            className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-5 py-2 disabled:opacity-50"
          >
            {building ? "Building knowledge graph…" : "Build Knowledge Graph"}
          </button>

          {graphResult && graph && (
            <div className="space-y-6">
              <p className="text-sm text-slate-500">
                {graphResult.node_count} entities, {graphResult.edge_count} relationships ingested into Neo4j.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <WorkspaceGraphExplorer graph={graph} onNodeClick={handleNodeClick} />
                </div>
                <EntityProfilePanel profile={entityProfile} onNavigate={handleNodeClick} />
              </div>

              {entityProfile && (
                <EntityImpactPanel
                  workspaceId={workspace.workspace_id}
                  table={entityProfile.table}
                  entityKey={entityProfile.key}
                />
              )}

              <GraphAnalyticsPanel analytics={graphResult.analytics} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
