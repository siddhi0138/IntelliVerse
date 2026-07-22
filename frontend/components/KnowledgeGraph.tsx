"use client";

import { useMemo } from "react";
import { Background, Controls, Edge, Node, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { KnowledgeGraph as KnowledgeGraphData } from "@/lib/types";

const NODE_COLORS: Record<string, { bg: string; border: string }> = {
  root: { bg: "#6366f1", border: "#4338ca" },
  entity: { bg: "#0ea5e9", border: "#0369a1" },
  dimension: { bg: "#10b981", border: "#047857" },
  time: { bg: "#f59e0b", border: "#b45309" },
  measure: { bg: "#ec4899", border: "#be185d" },
};

function layout(graph: KnowledgeGraphData): { nodes: Node[]; edges: Edge[] } {
  const root = graph.nodes.find((n) => n.node_type === "root");
  const rest = graph.nodes.filter((n) => n.node_type !== "root");
  const radius = 220;
  const centerX = 300;
  const centerY = 250;

  const nodes: Node[] = [];

  if (root) {
    nodes.push({
      id: root.id,
      position: { x: centerX, y: centerY },
      data: { label: root.label },
      style: {
        background: NODE_COLORS.root.bg,
        color: "white",
        border: `2px solid ${NODE_COLORS.root.border}`,
        borderRadius: 9999,
        fontWeight: 600,
        padding: "10px 18px",
      },
    });
  }

  rest.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / rest.length;
    const colors = NODE_COLORS[n.node_type] ?? NODE_COLORS.dimension;
    nodes.push({
      id: n.id,
      position: {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      },
      data: { label: n.label },
      style: {
        background: colors.bg,
        color: "white",
        border: `2px solid ${colors.border}`,
        borderRadius: 12,
        fontSize: 12,
        padding: "6px 12px",
      },
    });
  });

  const edges: Edge[] = graph.edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    label: e.label,
    style: { stroke: "#94a3b8" },
    labelStyle: { fill: "#64748b", fontSize: 11 },
  }));

  return { nodes, edges };
}

export function KnowledgeGraph({ graph }: { graph: KnowledgeGraphData }) {
  const { nodes, edges } = useMemo(() => layout(graph), [graph]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-2 h-[420px]">
      <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
