"use client";

import type { ClusteringResult } from "@/lib/types";
import { clusteringConfidence } from "@/lib/plainLanguage";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { ExpandableDetail } from "./ExpandableDetail";
import { Term } from "./Term";
import { useSimpleMode } from "./SimpleModeContext";

const CLUSTER_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

export function ClusteringPanel({ clustering }: { clustering: ClusteringResult | null }) {
  const { simpleMode } = useSimpleMode();
  if (!clustering) {
    return (
      <div className="card p-4">
        <h3 className="text-base font-semibold text-foreground mb-2">Segmentation</h3>
        <p className="text-sm text-muted">Not enough structure in this dataset to group rows meaningfully.</p>
      </div>
    );
  }

  return (
    <div className="group card p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex flex-wrap items-center gap-1">
          <h3 className="text-base font-semibold text-foreground">
            Segmentation ({clustering.k} clusters)
            {!simpleMode && (
              <span className="text-sm font-normal text-muted">
                {" "}
                — <Term id="silhouette">silhouette score</Term> {clustering.silhouette_score}
              </span>
            )}
          </h3>
          {simpleMode && (
            <ExpandableDetail>
              Grouping quality (<Term id="silhouette">silhouette score</Term>): {clustering.silhouette_score}
            </ExpandableDetail>
          )}
        </div>
        <ConfidenceBadge level={clusteringConfidence(clustering.silhouette_score)} />
      </div>
      <p className="text-xs text-muted mb-3">
        Rows were automatically grouped by similarity — the number of groups wasn&apos;t guessed, it was chosen
        because it split the data most cleanly.
      </p>
      <ul className="space-y-3">
        {clustering.clusters.map((c, i) => (
          <li key={c.cluster_id} className="text-sm">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}
              />
              <span className="font-medium">
                Group {c.cluster_id} ({c.size} rows)
              </span>
            </div>
            <p className="text-xs text-muted ml-4">
              {Object.entries(c.profile)
                .map(([k, v]) => `${k}=${v}`)
                .join(", ")}
            </p>
            {c.sample_ids.length > 0 && (
              <p className="text-xs text-muted ml-4">Examples: {c.sample_ids.join(", ")}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
