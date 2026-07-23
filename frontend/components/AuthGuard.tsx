"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, isAuthenticated } from "@/lib/auth";

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
        <div className="flex-shrink-0 flex justify-end items-center px-6 py-2 border-b border-slate-200/60 dark:border-slate-800/60">
          <button
            onClick={() => {
              clearToken();
              router.replace("/login");
            }}
            className="text-xs font-medium text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-full px-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-900"
          >
            Sign out
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">{children}</div>
    </div>
  );
}
