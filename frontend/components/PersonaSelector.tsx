"use client";

import { useState } from "react";
import { PERSONA_SUGGESTIONS } from "@/lib/persona";
import { usePersona } from "./PersonaContext";

export function PersonaSelector() {
  const { persona, setPersona } = usePersona();
  const [open, setOpen] = useState(false);

  const value = persona ?? "";
  const filtered = PERSONA_SUGGESTIONS.filter((p) => p.toLowerCase().includes(value.toLowerCase()));

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => setPersona(e.target.value || null)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="👤 I am a…"
        title="AI explanations are framed for this role — type any profession, or pick a suggestion"
        className="w-36 text-sm font-medium text-muted placeholder:text-muted dark:placeholder:text-muted bg-surface hover:bg-surface focus:bg-surface-elevated rounded-full px-3 py-1.5 border-none outline-none"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 top-full mt-1 w-48 rounded-lg border border-border bg-surface shadow-lg py-1 text-sm">
          {filtered.map((p) => (
            <li key={p}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setPersona(p);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-foreground hover:bg-surface"
              >
                {p}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
