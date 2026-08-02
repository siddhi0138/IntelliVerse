"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BrainCircuit } from "lucide-react";
import { fetchModelHistory } from "@/lib/api";
import type { ModelHistoryEntry } from "@/lib/types";
import { Panel, Badge } from "./ui";
import { TOOLTIP_STYLE } from "./charts";

// V9: persistent, incremental learning — this is the accuracy history of
// the online model in incremental_model.py, which updates itself with each
// new row (via partial_fit) instead of retraining from scratch. Each point
// is a genuine out-of-sample score: the model's prediction was made BEFORE
// it saw that row's actual value.
export function ModelLearningPanel({ analysisId, targetColumn }: { analysisId: string; targetColumn: string | null }) {
  const [history, setHistory] = useState<ModelHistoryEntry[] | null>(null);

  useEffect(() => {
    if (!targetColumn) return;
    let cancelled = false;
    fetchModelHistory(analysisId, targetColumn)
      .then((h) => {
        if (!cancelled) setHistory(h);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [analysisId, targetColumn]);

  if (!targetColumn || !history || history.length < 2) return null;

  const scored = history.filter((h) => h.abs_pct_error !== null);
  if (scored.length < 2) return null;

  const data = scored.map((h) => ({ update: h.n_updates, error: h.abs_pct_error }));
  const first = scored[0].abs_pct_error!;
  const last = scored[scored.length - 1].abs_pct_error!;
  const improved = last < first;

  return (
    <Panel
      title="Model learning curve"
      subtitle="Prediction error over successive updates — this model keeps learning from each new row instead of retraining from scratch."
      actions={
        <Badge tone={improved ? "good" : "neutral"}>
          <BrainCircuit className="h-3 w-3" /> {improved ? "Improving" : "Tracking"}
        </Badge>
      }
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis dataKey="update" stroke="#64748b" fontSize={12} label={{ value: "updates seen", position: "insideBottom", offset: -5, fontSize: 11, fill: "#64748b" }} />
            <YAxis stroke="#64748b" fontSize={12} unit="%" />
            <Tooltip {...TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="error" name="Abs % error" stroke="#a78bfa" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted mt-2">
        Error went from {first}% to {last}% across {scored.length} online updates.
      </p>
    </Panel>
  );
}
