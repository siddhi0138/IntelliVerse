import type { ClusteringResult } from "@/lib/types";

const CLUSTER_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

export function ClusteringPanel({ clustering }: { clustering: ClusteringResult | null }) {
  if (!clustering) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">Segmentation</h3>
        <p className="text-sm text-slate-500">Not enough numeric structure in this dataset to segment meaningfully.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
        Segmentation ({clustering.k} clusters)
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        K chosen automatically via silhouette score ({clustering.silhouette_score}) — not assumed.
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
                Cluster {c.cluster_id} ({c.size} rows)
              </span>
            </div>
            <p className="text-xs text-slate-500 ml-4">
              {Object.entries(c.profile)
                .map(([k, v]) => `${k}=${v}`)
                .join(", ")}
            </p>
            {c.sample_ids.length > 0 && (
              <p className="text-xs text-slate-500 ml-4">Examples: {c.sample_ids.join(", ")}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
