"use client";

import { createContext, useContext, useEffect, useState } from "react";

const SIMPLE_MODE_KEY = "nexus_simple_mode";

interface SimpleModeContextValue {
  simpleMode: boolean;
  setSimpleMode: (v: boolean) => void;
}

const SimpleModeContext = createContext<SimpleModeContextValue | null>(null);

export function SimpleModeProvider({ children }: { children: React.ReactNode }) {
  // Simple mode is the default for everyone — this only ever flips to
  // false once a returning user's own prior choice is read after mount,
  // so there's nothing to hydrate-mismatch on.
  const [simpleMode, setSimpleModeState] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(SIMPLE_MODE_KEY);
    if (stored === "false") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSimpleModeState(false);
    }
  }, []);

  function setSimpleMode(v: boolean) {
    localStorage.setItem(SIMPLE_MODE_KEY, String(v));
    setSimpleModeState(v);
  }

  return <SimpleModeContext.Provider value={{ simpleMode, setSimpleMode }}>{children}</SimpleModeContext.Provider>;
}

export function useSimpleMode(): SimpleModeContextValue {
  const ctx = useContext(SimpleModeContext);
  if (!ctx) throw new Error("useSimpleMode must be used within a SimpleModeProvider");
  return ctx;
}
