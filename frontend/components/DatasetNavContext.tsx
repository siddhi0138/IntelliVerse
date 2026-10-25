"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { TabId } from "@/components/GuidedTour";

// The dataset page owns which section (tab) is open, but the sections are listed in the
// sidebar, which lives in the layout above it. The page publishes its current section and
// a way to change it here; the sidebar reads it. Null whenever no dataset is open.
export type DatasetNav = { activeTab: TabId; onSelect: (id: TabId) => void } | null;

const DatasetNavContext = createContext<{ nav: DatasetNav; publish: (nav: DatasetNav) => void }>({
  nav: null,
  publish: () => {},
});

export function DatasetNavProvider({ children }: { children: ReactNode }) {
  const [nav, setNav] = useState<DatasetNav>(null);
  const publish = useCallback((next: DatasetNav) => setNav(next), []);
  const value = useMemo(() => ({ nav, publish }), [nav, publish]);
  return <DatasetNavContext.Provider value={value}>{children}</DatasetNavContext.Provider>;
}

export function useDatasetNav() {
  return useContext(DatasetNavContext);
}
