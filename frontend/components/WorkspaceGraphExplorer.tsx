"use client";

import { useMemo } from "react";
import { Background, Controls, Edge, Node, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WorkspaceGraph } from "@/lib/types";

const PALETTE = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6"];

function colorForTable(table: string, tableOrder: string[]): string {
  const idx = tableOrder.indexOf(table);
  return PALETTE[idx % PALETTE.length];
}

function layout(graph: WorkspaceGraph): { nodes: Node[]; edges: Edge[] } {
  const tables = Array.from(new Set(graph.nodes.map((n) => n.table)));
  const macroRadius = 320;
  const centerX = 400;
  const centerY = 320;

  const nodesByTable = new Map<string, typeof graph.nodes>();
  for (const n of graph.nodes) {
    if (!nodesByTable.has(n.table)) nodesByTable.set(n.table, []);
    nodesByTable.get(n.table)!.push(n);
  }

  const nodes: Node[] = [];
  tables.forEach((table, tIdx) => {
    const angle = (2 * Math.PI * tIdx) / tables.length;
    const clusterX = centerX + macroRadius * Math.cos(angle);
    const clusterY = centerY + macroRadius * Math.sin(angle);
    const tableNodes = nodesByTable.get(table) ?? [];
    const microRadius = Math.min(30 + tableNodes.length * 8, 140);
    const color = colorForTable(table, tables);

    tableNodes.forEach((n, i) => {
      const microAngle = (2 * Math.PI * i) / Math.max(tableNodes.length, 1);
      nodes.push({
        id: n.id,
        position: {
          x: clusterX + microRadius * Math.cos(microAngle),
          y: clusterY + microRadius * Math.sin(microAngle),
        },
        data: { label: n.key },
        style: {
          background: color,
          color: "white",
          border: `1px solid ${color}`,
          borderRadius: 8,
          fontSize: 10,
          padding: "3px 8px",
          opacity: 0.6 + Math.min(n.degree / 10, 1) * 0.4,
        },
      });
    });
  });

  const edges: Edge[] = graph.edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    label: e.type,
    style: { stroke: "#cbd5e1" },
    labelStyle: { fontSize: 9, fill: "#94a3b8" },
  }));

  return { nodes, edges };
}

export function WorkspaceGraphExplorer({
  graph,
  onNodeClick,
}: {
  graph: WorkspaceGraph;
  onNodeClick: (table: string, key: string) => void;
}) {
  const { nodes, edges } = useMemo(() => layout(graph), [graph]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-2 h-[520px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => {
          const graphNode = graph.nodes.find((n) => n.id === node.id);
          if (graphNode) onNodeClick(graphNode.table, graphNode.key);
        }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
