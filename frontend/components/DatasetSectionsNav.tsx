"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useDatasetNav } from "@/components/DatasetNavContext";
import { TABS, TAB_GROUPS } from "@/lib/datasetTabs";

// The open dataset's sections, listed in the sidebar as three collapsible groups
// (Analyze / Investigate / Decide). Only shown while a dataset is open. The group that
// holds the current section starts expanded and the others collapsed; any group can be
// toggled by hand.
//
// Laid out on the same grid as the sidebar's main links: a group header is a row like them
// (px-3.5, a 20px icon, then the label), and the sections under it start in that same label
// column, so every label in the sidebar lines up.
export function DatasetSectionsNav({ onNavigate }: { onNavigate?: () => void }) {
  const { nav } = useDatasetNav();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  if (!nav) return null;

  return (
    <div className="mt-3 space-y-1.5 border-t border-border pt-3" data-sidebar="dataset-sections">
      <p className="px-3.5 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted">Dataset</p>
      {TAB_GROUPS.map((group) => {
        const containsActive = group.ids.includes(nav.activeTab);
        const open = expanded[group.title] ?? containsActive;
        return (
          <div key={group.title}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setExpanded((prev) => ({ ...prev, [group.title]: !open }))}
              className={`group flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left transition-all ${
                containsActive ? "text-foreground" : "text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              <group.icon className={`h-5 w-5 shrink-0 ${containsActive ? "text-primary" : "text-muted group-hover:text-foreground"}`} />
              <span className="flex-1 truncate">{group.title}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="mt-0.5 space-y-0.5">
                {group.ids.map((id) => {
                  const tab = TABS.find((t) => t.id === id)!;
                  const active = nav.activeTab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      data-tab={id}
                      onClick={() => {
                        nav.onSelect(id);
                        onNavigate?.();
                      }}
                      // Starts in the label column: 14px row padding + 20px icon + 12px gap = 46px. Set as an
                      // inline style so the exact indent never depends on a generated utility class.
                      style={{ paddingLeft: "2.875rem" }}
                      className={`flex w-full items-center rounded-lg py-2 pr-3.5 text-left text-[15px] transition-all ${
                        active ? "bg-white/5 text-foreground ring-1 ring-primary/30" : "text-muted hover:bg-surface hover:text-foreground"
                      }`}
                    >
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
