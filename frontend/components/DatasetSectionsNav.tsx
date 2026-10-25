"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useDatasetNav } from "@/components/DatasetNavContext";
import { TABS, TAB_GROUPS } from "@/lib/datasetTabs";

// The open dataset's sections, listed in the sidebar as three collapsible groups
// (Analyze / Investigate / Decide). Only shown while a dataset is open. The group that
// holds the current section starts expanded and the others collapsed; any group can be
// toggled by hand.
export function DatasetSectionsNav({ onNavigate }: { onNavigate?: () => void }) {
  const { nav } = useDatasetNav();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  if (!nav) return null;

  return (
    <div className="mt-3 space-y-1 border-t border-border pt-3" data-sidebar="dataset-sections">
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
              className={`flex w-full items-center justify-between rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                containsActive ? "text-foreground" : "text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              <span>{group.title}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="mt-0.5 space-y-0.5 pl-2">
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
                      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all ${
                        active ? "bg-primary/10 text-foreground ring-1 ring-primary/20" : "text-muted hover:bg-surface hover:text-foreground"
                      }`}
                    >
                      <tab.icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "group-hover:text-foreground"}`} />
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
