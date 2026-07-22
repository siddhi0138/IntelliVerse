"use client";

import { useMemo } from "react";
import { Background, Controls, Edge, Node, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SimulationResult } from "@/lib/types";

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "#10b981",
  medium: "#f59e0b",
  low: "#94a3b8",
};

function fmtDelta(pct: number | null): string {
  if (pct === null) return "n/a";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function layout(result: SimulationResult): { nodes: Node[]; edges: Edge[] } {
  const centerX = 300;
  const centerY = 250;
  const radius = 200;

  const driver = result.effects.find((e) => e.column === result.driver_column);
  const dependents = result.effects.filter((e) => e.column !== result.driver_column);

  const nodes: Node[] = [
    {
      id: "driver",
      position: { x: centerX, y: centerY },
      data: { label: `${result.driver_label}\n${fmtDelta(driver?.delta_pct ?? result.pct_change)}` },
      style: {
        background: "#6366f1",
        color: "white",
        border: "2px solid #4338ca",
        borderRadius: 9999,
        fontWeight: 600,
        padding: "12px 18px",
        whiteSpace: "pre-line",
        textAlign: "center",
        fontSize: 13,
      },
    },
  ];

  const edges: Edge[] = [];

  dependents.forEach((e, i) => {
    const angle = (2 * Math.PI * i) / Math.max(dependents.length, 1);
    const color = CONFIDENCE_COLOR[e.confidence] ?? CONFIDENCE_COLOR.low;
    nodes.push({
      id: e.column,
      position: { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) },
      data: { label: `${e.semantic_label}\n${fmtDelta(e.delta_pct)}` },
      style: {
        background: color,
        color: "white",
        border: `2px solid ${color}`,
        borderRadius: 12,
        padding: "8px 14px",
        fontSize: 12,
        whiteSpace: "pre-line",
        textAlign: "center",
      },
    });
    edges.push({
      id: `edge-${e.column}`,
      source: "driver",
      target: e.column,
      label: `r²=${e.r_squared.toFixed(2)} · ${e.relationship}`,
      style: { stroke: color },
      labelStyle: { fontSize: 10, fill: "#64748b" },
      animated: e.confidence === "high",
    });
  });

  return { nodes, edges };
}

export function DecisionGraph({ result }: { result: SimulationResult }) {
  const { nodes, edges } = useMemo(() => layout(result), [result]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 h-[420px]">
      <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
