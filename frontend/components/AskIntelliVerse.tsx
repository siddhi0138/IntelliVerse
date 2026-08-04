"use client";

import { useEffect, useState } from "react";
import { askQuestion, clearAskHistory, deleteAskHistoryEntry, fetchAskHistory } from "@/lib/api";
import type { AskResponse } from "@/lib/types";

type Message = AskResponse & { question: string };

export function AskIntelliVerse({
  analysisId,
  domain,
  primaryMetric,
}: {
  analysisId: string;
  domain: string;
  primaryMetric: string | null;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  // Ask IntelliVerse used to lose its whole conversation on refresh or tab
  // switch — the backend now keeps every exchange for this dataset, so a
  // fresh mount just replays it instead of starting blank.
  useEffect(() => {
    let cancelled = false;
    fetchAskHistory(analysisId)
      .then((history) => {
        if (!cancelled) setMessages(history);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  async function ask() {
    const q = question.trim();
    if (!q) return;
    setAsking(true);
    setError(null);
    try {
      const res = await askQuestion(analysisId, domain, q, primaryMetric);
      setMessages((prev) => [...prev, { question: q, ...res }]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not answer that question.");
    } finally {
      setAsking(false);
    }
  }

  async function handleClearHistory() {
    if (!window.confirm("Clear the whole conversation for this dataset? This can't be undone.")) return;
    setClearing(true);
    try {
      await clearAskHistory(analysisId);
      setMessages([]);
    } finally {
      setClearing(false);
    }
  }

  async function handleDeleteMessage(index: number) {
    setDeletingIndex(index);
    try {
      await deleteAskHistoryEntry(analysisId, index);
      setMessages((prev) => prev.filter((_, i) => i !== index));
    } finally {
      setDeletingIndex(null);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-foreground">Ask IntelliVerse</h3>
        {messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            disabled={clearing}
            className="text-xs text-muted hover:text-red-400 disabled:opacity-50"
          >
            {clearing ? "Clearing…" : "Clear history"}
          </button>
        )}
      </div>

      {messages.length > 0 && (
        <div className="space-y-4 mb-4 max-h-[480px] overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className="group border-b border-border/60 last:border-0 pb-4 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{m.question}</p>
                <button
                  onClick={() => handleDeleteMessage(i)}
                  disabled={deletingIndex === i}
                  title="Delete this exchange"
                  className="shrink-0 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 disabled:opacity-50 text-xs"
                >
                  {deletingIndex === i ? "…" : "✕"}
                </button>
              </div>
              <p className="text-sm text-muted mt-1">{m.answer}</p>
              <p className="text-xs text-muted/70 mt-1">Computed via: {m.intent.replace("_", " ")}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="e.g. Why did revenue change? What's trending?"
          className="flex-1 rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm"
        />
        <button onClick={ask} disabled={asking || !question.trim()} className="btn-primary">
          {asking ? "Thinking…" : "Ask"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 mt-3" title={error}>
          Couldn&apos;t answer that right now — AI-generated answers are temporarily unavailable.
        </p>
      )}
    </div>
  );
}
