"use client";

import { useState } from "react";
import { askQuestion } from "@/lib/api";
import type { AskResponse } from "@/lib/types";

export function AskIntelliVerse({
  analysisId,
  domain,
  primaryMetric,
}: {
  analysisId: string;
  domain: string;
  primaryMetric: string | null;
}) {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    if (!question.trim()) return;
    setAsking(true);
    setError(null);
    setResponse(null);
    try {
      const res = await askQuestion(analysisId, domain, question.trim(), primaryMetric);
      setResponse(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not answer that question.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">Ask IntelliVerse</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="e.g. Why did revenue change? What's trending?"
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-800 bg-transparent px-3 py-1.5 text-sm"
        />
        <button
          onClick={ask}
          disabled={asking || !question.trim()}
          className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-50"
        >
          {asking ? "Thinking…" : "Ask"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>}

      {response && (
        <div className="mt-3 text-sm text-slate-700 dark:text-slate-300">
          <p>{response.answer}</p>
          <p className="text-xs text-slate-500 mt-1">Computed via: {response.intent.replace("_", " ")}</p>
        </div>
      )}
    </div>
  );
}
