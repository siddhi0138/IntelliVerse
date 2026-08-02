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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl card p-0 shadow-xl mt-16"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Glossary</h3>
          <button
            onClick={onClose}
            aria-label="Close glossary"
            className="rounded-full w-7 h-7 flex items-center justify-center text-muted hover:text-foreground dark:hover:text-white hover:bg-surface"
          >
            ✕
          </button>
        </div>
        <div className="p-4 border-b border-border">
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search terms…"
            className="w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
          {entries.length === 0 && (
            <p className="p-4 text-sm text-muted">No terms match &quot;{search}&quot;.</p>
          )}
          {entries.map((e) => (
            <div key={e.term} className="p-4">
              <p className="text-sm font-semibold text-foreground mb-1">{e.term}</p>
              <p className="text-sm text-muted leading-relaxed">{e.definition}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
