"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

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
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">{children}</div>
    </div>
  );
}
