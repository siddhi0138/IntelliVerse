"use client";

import { useState } from "react";
import { GLOSSARY } from "@/lib/glossary";

export function GlossaryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [search, setSearch] = useState("");

  if (!open) return null;

  const entries = Object.values(GLOSSARY)
    .filter(
      (e) =>
        !search ||
        e.term.toLowerCase().includes(search.toLowerCase()) ||
        e.definition.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.term.localeCompare(b.term));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl mt-16"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Glossary</h3>
          <button
            onClick={onClose}
            aria-label="Close glossary"
            className="rounded-full w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search terms…"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {entries.length === 0 && (
            <p className="p-4 text-sm text-slate-500">No terms match &quot;{search}&quot;.</p>
          )}
          {entries.map((e) => (
            <div key={e.term} className="p-4">
              <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{e.term}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{e.definition}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
