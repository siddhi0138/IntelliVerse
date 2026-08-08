"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Workflow, Database, MessageSquareText, BookOpen, LogOut, Menu, ChevronLeft, ChevronRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { GlossaryModal } from "@/components/GlossaryModal";
import { clearToken, getUsername } from "@/lib/auth";

// Distinct colors per link (instead of every active item reading the same
// flat cyan) — same teal/violet/amber palette used across the dataset tabs'
// StatCards, so the sidebar isn't the one monochrome corner of the app.
// Ordered as a beginner-to-advanced story rather than alphabetically/
// arbitrarily: Catalog is where everyone ends up right after their first
// upload (the logo/home link above this list IS the upload step); Workspace
// and Knowledge Assistant are both opt-in power features layered on top of
// that single-dataset basics, so they come after.
const NAV_LINKS = [
  { href: "/catalog", label: "Dataset Catalog", icon: Database, color: "#a78bfa" },
  { href: "/workspace", label: "Multi-table Workspace", icon: Workflow, color: "#5eead4" },
  { href: "/knowledge", label: "Knowledge Assistant", icon: MessageSquareText, color: "#fbbf24" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    // Re-reads on every nav since login can happen on a different page than
    // the one that first mounted the sidebar (same pattern as PersonaContext).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsername(getUsername());
  }, [pathname]);

  if (pathname === "/login") return null;

  const closeMobile = () => setMobileOpen(false);

  function signOut() {
    clearToken();
    router.replace("/login");
  }

  const navContent = (
    <>
      <div className="flex items-center gap-2.5 h-16 px-5 border-b border-border shrink-0">
        <Link
          href="/"
          onClick={() => {
            closeMobile();
            // Next's router treats a Link to the route we're already on as a
            // no-op — it won't remount the page or reset its in-memory
            // state, so clicking this while a dataset is open silently did
            // nothing. Home listens for this event to clear that state too.
            window.dispatchEvent(new Event("intelliverse:go-home"));
          }}
          className="flex items-center gap-2.5 flex-1 min-w-0"
        >
          <Logo />
          <span className="font-display text-xl font-bold tracking-tight truncate">IntelliVerse</span>
        </Link>
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
          className="hidden md:flex w-7 h-7 shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground hover:bg-surface"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
      <nav className="flex-1 p-3 space-y-1.5 text-base font-medium overflow-y-auto">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeMobile}
              className={`group flex items-center gap-3 rounded-lg px-3.5 py-2.5 transition-all ${
                active ? "bg-white/5 text-foreground" : "text-muted hover:bg-surface hover:text-foreground"
              }`}
              style={active ? { boxShadow: `inset 0 0 0 1px ${link.color}40` } : undefined}
            >
              <link.icon
                className={`h-5 w-5 shrink-0 ${active ? "" : "text-muted group-hover:text-foreground"}`}
                style={active ? { color: link.color } : undefined}
              />
              <span className="truncate">{link.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => {
            setGlossaryOpen(true);
            closeMobile();
          }}
          className="group w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-muted hover:bg-surface hover:text-foreground transition-all"
        >
          <BookOpen className="h-5 w-5 shrink-0 text-muted group-hover:text-foreground" />
          <span>Glossary</span>
        </button>
      </nav>
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex items-center gap-2 px-1 mb-2 min-w-0">
          <div className="relative h-9 w-9 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center text-base font-medium">
            {username?.[0]?.toUpperCase() ?? "?"}
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-background bg-accent" />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-base text-foreground truncate">{username ?? "Guest"}</p>
            <p className="text-xs uppercase tracking-wide text-muted">Online</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-2 text-sm font-medium text-muted hover:text-red-400 hover:bg-surface"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          aria-label="Expand sidebar"
          className="hidden md:flex md:w-6 md:shrink-0 md:flex-col md:items-center md:justify-center md:border-r md:border-border md:bg-surface hover:bg-surface-elevated"
        >
          <ChevronRight className="w-4 h-4 text-muted" />
        </button>
      ) : (
        <aside className="hidden md:flex md:w-72 md:shrink-0 md:flex-col md:border-r md:border-border md:bg-background/60 md:backdrop-blur-xl">
          {navContent}
        </aside>
      )}

      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between h-14 px-4 border-b border-border bg-background/70 backdrop-blur-xl">
        <Link href="/" onClick={() => window.dispatchEvent(new Event("intelliverse:go-home"))} className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="font-display text-lg font-bold tracking-tight">IntelliVerse</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={closeMobile} />
          <div className="relative w-64 max-w-[80%] h-full bg-background border-r border-border flex flex-col">
            {navContent}
          </div>
        </div>
      )}

      <GlossaryModal open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
    </>
  );
}
