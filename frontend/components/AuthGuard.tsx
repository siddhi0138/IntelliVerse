"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

const PAGE_TITLES: Record<string, string> = {
  "/": "",
  "/workspace": "🕸️ Multi-table Workspace",
  "/catalog": "🗂️ Dataset Catalog",
  "/knowledge": "📄 Knowledge Assistant",
};

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const authed = isAuthenticated();
    if (!authed && pathname !== "/login") {
      router.replace("/login");
    } else if (authed && pathname === "/login") {
      router.replace("/");
    }
  }, [pathname, router]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {pathname !== "/login" && (
        <div className="flex-shrink-0 h-12 flex items-center px-4 sm:px-6 border-b border-border bg-background">
          <span className="text-sm font-medium text-muted">{PAGE_TITLES[pathname] ?? "IntelliVerse"}</span>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">{children}</div>
    </div>
  );
}
