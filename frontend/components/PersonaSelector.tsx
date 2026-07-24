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
        className="w-36 text-sm font-medium text-slate-600 dark:text-slate-300 placeholder:text-slate-500 dark:placeholder:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 focus:bg-slate-200 dark:focus:bg-slate-700 rounded-full px-3 py-1.5 border-none outline-none"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 top-full mt-1 w-48 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg py-1 text-sm">
          {filtered.map((p) => (
            <li key={p}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setPersona(p);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
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
