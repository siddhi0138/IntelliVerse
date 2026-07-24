"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, isAuthenticated } from "@/lib/auth";
import { useTheme } from "@/components/ThemeContext";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

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
        <div className="flex-shrink-0 flex justify-end items-center gap-1 px-6 py-2 border-b border-slate-200/60 dark:border-slate-800/60">
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="text-xs font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full w-7 h-7 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-900"
          >
            {theme === "dark" ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M12 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm0 15a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Zm9-6a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1ZM6 12a1 1 0 0 1-1 1H4a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1Zm11.66 6.66a1 1 0 0 1-1.41 0l-.71-.71a1 1 0 1 1 1.41-1.41l.71.71a1 1 0 0 1 0 1.41ZM7.46 7.46a1 1 0 0 1-1.41 0l-.71-.71A1 1 0 1 1 6.75 5.34l.71.71a1 1 0 0 1 0 1.41Zm11.2-1.41a1 1 0 0 1 0 1.41l-.71.71a1 1 0 1 1-1.41-1.41l.71-.71a1 1 0 0 1 1.41 0ZM6.75 18.66a1 1 0 0 1 0-1.41l.71-.71a1 1 0 1 1 1.41 1.41l-.71.71a1 1 0 0 1-1.41 0ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M20.354 15.354A9 9 0 0 1 8.646 3.646a9.003 9.003 0 1 0 11.708 11.708Z" />
              </svg>
            )}
          </button>
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
