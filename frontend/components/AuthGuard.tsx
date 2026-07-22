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
    <>
      {pathname !== "/login" && (
        <div className="flex justify-end px-6 pt-3">
          <button
            onClick={() => {
              clearToken();
              router.replace("/login");
            }}
            className="text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            Sign out
          </button>
        </div>
      )}
      {children}
    </>
  );
}
