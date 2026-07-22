"use client";

import { useState } from "react";
import { updateSemanticLabel } from "@/lib/api";
import type { ColumnSchema } from "@/lib/types";

const TYPE_COLORS: Record<string, string> = {
  id: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  numeric: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  date: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  categorical: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  boolean: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  text: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

function confidenceColor(confidence: number): string {
  if (confidence >= 0.9) return "text-emerald-600 dark:text-emerald-400";
  if (confidence >= 0.6) return "text-amber-600 dark:text-amber-400";
  return "text-slate-500";
}

function EditableLabel({
  column,
  analysisId,
  onSaved,
}: {
  column: ColumnSchema;
  analysisId: string;
  onSaved: (name: string, label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(column.semantic_label);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!value.trim() || value === column.semantic_label) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateSemanticLabel(analysisId, column.name, value.trim());
      onSaved(column.name, value.trim());
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && save()}
        className="rounded border border-indigo-300 dark:border-indigo-700 bg-transparent px-1.5 py-0.5 text-sm w-full"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-left hover:underline decoration-dotted underline-offset-2"
      title="Click to correct this label"
    >
      {column.semantic_label}
    </button>
  );
}

export function SchemaTable({ schema, analysisId }: { schema: ColumnSchema[]; analysisId?: string }) {
  // keyed by analysisId in the parent, so a new upload remounts this
  // component and resets local edit state instead of syncing via effect
  const [localSchema, setLocalSchema] = useState(schema);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
            <th className="px-4 py-2 font-medium">Column</th>
            <th className="px-4 py-2 font-medium">Inferred meaning</th>
            <th className="px-4 py-2 font-medium">Confidence</th>
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium">Unique</th>
          </tr>
        </thead>
        <tbody>
          {localSchema.map((col) => (
            <tr key={col.name} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
              <td className="px-4 py-2 font-mono text-xs">{col.name}</td>
              <td className="px-4 py-2">
                {analysisId ? (
                  <EditableLabel
                    column={col}
                    analysisId={analysisId}
                    onSaved={(name, label) =>
                      setLocalSchema((prev) =>
                        prev.map((c) => (c.name === name ? { ...c, semantic_label: label, confidence: 1 } : c))
                      )
                    }
                  />
                ) : (
                  col.semantic_label
                )}
              </td>
              <td className={`px-4 py-2 text-xs ${confidenceColor(col.confidence)}`}>
                {Math.round(col.confidence * 100)}%
              </td>
              <td className="px-4 py-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[col.type] ?? ""}`}>
                  {col.type}
                </span>
              </td>
              <td className="px-4 py-2 text-slate-500">{String(col.stats.unique_count ?? "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
