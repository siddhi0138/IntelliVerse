"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, register } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "login") {
        await login(username, password);
        router.replace("/");
      } else {
        await register(username, password);
        setMode("login");
        setPassword("");
        setNotice("Account created — sign in below.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex-1 flex items-center justify-center px-6 overflow-hidden bg-surface">
      {/* The root layout's own fixed ambient gradient already washes every
          route including this one — this page used to stack a second full
          .bg-hero overlay plus a 600px-wide glow blob (wider than an entire
          phone screen) on top of that, which read as one overpowering teal
          wash on small viewports. Just the blob remains, much smaller. */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-32 sm:h-48 w-[60vw] max-w-[420px] rounded-full bg-accent-gradient opacity-20 blur-3xl animate-pulse-glow pointer-events-none" />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface/80 backdrop-blur p-8 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.6)]">
        <h1 className="font-display text-3xl tracking-tight text-center mb-1 text-white">IntelliVerse</h1>
        <p className="text-muted text-center mb-8">
          {mode === "login" ? "Sign in to continue" : "Create an account"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              className="w-full rounded-lg border border-border bg-black/20 px-3 py-2 text-sm text-white focus:border-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-border bg-black/20 px-3 py-2 text-sm text-white focus:border-primary outline-none"
            />
          </div>

          {notice && <p className="text-sm text-emerald-400">{notice}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-2">
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
            setNotice(null);
          }}
          className="w-full text-center text-sm text-primary hover:underline mt-4"
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
