import type { GraphAnalytics } from "@/lib/types";
import { Term } from "./Term";

export function GraphAnalyticsPanel({ analytics }: { analytics: GraphAnalytics }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-base font-semibold text-foreground mb-1">Graph Analytics</h3>
      <p className="text-xs text-muted mb-3">Which records matter most, based on how they connect to everything else.</p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted mb-2">
            <Term id="pagerank">Most influential</Term>
          </p>
          <ul className="text-sm space-y-1">
            {analytics.top_pagerank.map((e, i) => (
              <li key={i}>
                {e.table}:{e.key} <span className="text-xs text-muted">({e.score})</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted mb-2">
            <Term id="centrality">Most connected</Term>
          </p>
          <ul className="text-sm space-y-1">
            {analytics.top_degree_centrality.map((e, i) => (
              <li key={i}>
                {e.table}:{e.key} <span className="text-xs text-muted">({e.score})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-xs text-muted">
        {analytics.connected_components} connected component(s)
        {analytics.component_sizes.length > 0 && <> — sizes: {analytics.component_sizes.join(", ")}</>}
      </p>
    </div>
  );
}
