"use client";

import { useState } from "react";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

export function Term({ id, children }: { id: GlossaryKey; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const entry = GLOSSARY[id];

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className="border-b border-dotted border-slate-400 dark:border-slate-600 cursor-help hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        {children}
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-0 top-full mt-1 w-64 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-3 text-xs text-slate-600 dark:text-slate-300 normal-case font-normal leading-relaxed"
        >
          <span className="block font-semibold text-slate-900 dark:text-white mb-1">{entry.term}</span>
          {entry.definition}
        </span>
      )}
    </span>
  );
}
