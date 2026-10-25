import {
  LayoutDashboard,
  Database,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  GitBranch,
  Workflow,
  Target,
  ListChecks,
  MessageSquareText,
  Terminal,
  Search,
} from "lucide-react";
import type { ComponentType } from "react";
import type { TabId } from "@/components/GuidedTour";

export type TabDef = { id: TabId; label: string; icon: ComponentType<{ className?: string }> };
export type TabGroup = { title: string; icon: ComponentType<{ className?: string }>; ids: TabId[] };

export const TABS: TabDef[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "schema", label: "Schema", icon: Database },
  { id: "stats", label: "Statistics", icon: BarChart3 },
  { id: "forecast", label: "Forecast", icon: TrendingUp },
  { id: "anomalies", label: "Anomalies", icon: AlertTriangle },
  { id: "rootcause", label: "Root cause", icon: GitBranch },
  { id: "graph", label: "Knowledge graph", icon: Workflow },
  { id: "simulation", label: "Simulation", icon: Target },
  { id: "action", label: "Action plan", icon: ListChecks },
  { id: "ask", label: "Ask IntelliVerse", icon: MessageSquareText },
  { id: "sql", label: "SQL Query", icon: Terminal },
];

// Matches the reference workspace shell's grouping (Analyze / Investigate /
// Decide) — same three buckets, same tab order within each. SQL query gets
// its own tab in Decide rather than being bundled inside Ask IntelliVerse —
// ad-hoc SQL is a distinct power-user tool, not a follow-up to chat.
export const TAB_GROUPS: TabGroup[] = [
  { title: "Analyze", icon: BarChart3, ids: ["overview", "schema", "stats"] },
  { title: "Investigate", icon: Search, ids: ["forecast", "anomalies", "rootcause"] },
  { title: "Decide", icon: Target, ids: ["graph", "simulation", "action", "ask", "sql"] },
];
