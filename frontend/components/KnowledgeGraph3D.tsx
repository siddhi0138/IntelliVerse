"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import type { Mesh } from "three";
import type { KnowledgeGraph as KnowledgeGraphData, GraphNodeType } from "@/lib/types";

const NODE_COLORS: Record<GraphNodeType, string> = {
  root: "#6366f1",
  entity: "#0ea5e9",
  dimension: "#10b981",
  time: "#f59e0b",
  measure: "#ec4899",
};

interface LaidOutNode {
  id: string;
  label: string;
  node_type: GraphNodeType;
  position: [number, number, number];
}

function layout3D(graph: KnowledgeGraphData): LaidOutNode[] {
  const root = graph.nodes.find((n) => n.node_type === "root");
  const rest = graph.nodes.filter((n) => n.node_type !== "root");
  const radius = 4;

  const nodes: LaidOutNode[] = [];
  if (root) nodes.push({ id: root.id, label: root.label, node_type: root.node_type, position: [0, 0, 0] });

  // Fibonacci sphere: spreads nodes evenly across a sphere's surface so a
  // moderately sized graph doesn't clump when viewed from any angle.
  const n = rest.length;
  rest.forEach((node, i) => {
    const y = n > 1 ? 1 - (i / (n - 1)) * 2 : 0;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * Math.PI * (3 - Math.sqrt(5));
    nodes.push({
      id: node.id,
      label: node.label,
      node_type: node.node_type,
      position: [Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius],
    });
  });

  return nodes;
}

function NodeSphere({ node, onHover }: { node: LaidOutNode; onHover: (label: string | null) => void }) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const size = node.node_type === "root" ? 0.35 : 0.22;

  useFrame(() => {
    if (meshRef.current) meshRef.current.scale.setScalar(hovered ? 1.4 : 1);
  });

  return (
    <group position={node.position}>
      <mesh
        ref={meshRef}
        onPointerOver={() => {
          setHovered(true);
          onHover(node.label);
        }}
        onPointerOut={() => {
          setHovered(false);
          onHover(null);
        }}
      >
        <sphereGeometry args={[size, 24, 24]} />
        <meshStandardMaterial color={NODE_COLORS[node.node_type]} emissive={NODE_COLORS[node.node_type]} emissiveIntensity={hovered ? 0.6 : 0.2} />
      </mesh>
      {(node.node_type === "root" || hovered) && (
        <Html distanceFactor={10} center style={{ pointerEvents: "none" }}>
          <div className="px-2 py-0.5 rounded bg-slate-900/80 text-white text-xs whitespace-nowrap">{node.label}</div>
        </Html>
      )}
    </group>
  );
}

export function KnowledgeGraph3D({ graph }: { graph: KnowledgeGraphData }) {
  const nodes = useMemo(() => layout3D(graph), [graph]);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const [, setHoveredLabel] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-950 h-[420px] overflow-hidden">
      <Canvas camera={{ position: [0, 2, 9], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        {graph.edges.map((edge, i) => {
          const source = nodeById.get(edge.source);
          const target = nodeById.get(edge.target);
          if (!source || !target) return null;
          return <Line key={i} points={[source.position, target.position]} color="#475569" lineWidth={1} />;
        })}
        {nodes.map((node) => (
          <NodeSphere key={node.id} node={node} onHover={setHoveredLabel} />
        ))}
        <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.6} />
      </Canvas>
    </div>
  );
}
