import type { GraphAnalytics } from "@/lib/types";

export function GraphAnalyticsPanel({ analytics }: { analytics: GraphAnalytics }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Graph Analytics</h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Most influential (PageRank)</p>
          <ul className="text-sm space-y-1">
            {analytics.top_pagerank.map((e, i) => (
              <li key={i}>
                {e.table}:{e.key} <span className="text-xs text-slate-500">({e.score})</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Most connected (degree)</p>
          <ul className="text-sm space-y-1">
            {analytics.top_degree_centrality.map((e, i) => (
              <li key={i}>
                {e.table}:{e.key} <span className="text-xs text-slate-500">({e.score})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        {analytics.connected_components} connected component(s)
        {analytics.component_sizes.length > 0 && <> — sizes: {analytics.component_sizes.join(", ")}</>}
      </p>
    </div>
  );
}
