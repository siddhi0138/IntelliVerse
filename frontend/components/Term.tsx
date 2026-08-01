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
        className="border-b border-dotted border-border cursor-help hover:text-primary"
      >
        {children}
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-0 top-full mt-1 w-64 rounded-lg border border-border bg-surface shadow-lg p-3 text-xs text-muted normal-case font-normal leading-relaxed"
        >
          <span className="block font-semibold text-foreground mb-1">{entry.term}</span>
          {entry.definition}
        </span>
      )}
    </span>
  );
}
