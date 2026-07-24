"use client";

import { useState } from "react";

// Icon-only, fully invisible until you hover the surrounding text (the
// nearest ancestor needs the `group` class) — same "nothing there until you
// hover the row" affordance as WhatsApp's per-message action button. No
// permanent label text; clicking reveals the data below. Renders as a
// Fragment (button, then the content block) so the caller can place the
// trigger inline right next to the sentence it belongs to, inside a
// `flex flex-wrap` row — the content block below uses `basis-full` so it
// still drops to its own full-width line when opened.
//
// Always starts closed, in both Simple and Expert mode — this is a manual
// "dig deeper if you want to" affordance, not what distinguishes the two
// modes. The mode difference lives in the surrounding sentence's wording
// (see lib/plainLanguage.ts's `detailed` parameter), not in what's
// collapsed.
export function ExpandableDetail({ label = "Show the numbers", children }: { label?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={open ? "Hide the numbers" : label}
        aria-label={open ? "Hide the numbers" : label}
        aria-expanded={open}
        className={`shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full transition-opacity ${
          open
            ? "opacity-100 text-indigo-600 dark:text-indigo-400"
            : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && <div className="basis-full w-full mt-1 text-xs text-slate-500">{children}</div>}
    </>
  );
}
