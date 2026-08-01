"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { GlossaryModal } from "@/components/GlossaryModal";
import { clearToken, getUsername } from "@/lib/auth";

const NAV_LINKS = [
  { href: "/workspace", label: "Multi-table workspace", emoji: "🕸️" },
  { href: "/catalog", label: "Dataset catalog", emoji: "🗂️" },
  { href: "/knowledge", label: "Knowledge Assistant", emoji: "📄" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
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
        <Link href="/" onClick={closeMobile} className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="relative inline-flex shrink-0">
            <Logo />
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-background bg-primary animate-pulse" />
          </span>
          <span className="font-display text-xl tracking-tight truncate">IntelliVerse</span>
        </Link>
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
          className="hidden md:flex w-7 h-7 shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground hover:bg-surface"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>
      <nav className="flex-1 p-3 space-y-1 text-base overflow-y-auto">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeMobile}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 transition ${
                active ? "bg-primary/10 text-primary font-medium" : "text-muted hover:text-foreground hover:bg-surface"
              }`}
            >
              <span className="shrink-0">{link.emoji}</span>
              <span className="truncate">{link.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => {
            setGlossaryOpen(true);
            closeMobile();
          }}
          className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-muted hover:text-foreground hover:bg-surface transition"
        >
          <span className="shrink-0">📖</span>
          <span>Glossary</span>
        </button>
      </nav>
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex items-center gap-2 px-1 mb-2 min-w-0">
          <div className="relative h-8 w-8 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-medium">
            {username?.[0]?.toUpperCase() ?? "?"}
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-background bg-primary animate-pulse" />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-base text-foreground truncate">{username ?? "Guest"}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted">🟢 Online</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-muted hover:text-red-400 hover:bg-surface"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-3.5 h-3.5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M18 12H8.25m9.75 0-3-3m3 3-3 3" />
          </svg>
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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4 text-muted">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      ) : (
        <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-r md:border-border md:bg-surface">
          {navContent}
        </aside>
      )}

      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between h-14 px-4 border-b border-border bg-background">
        <Link href="/" className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="font-display text-lg tracking-tight">IntelliVerse</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          </svg>
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
