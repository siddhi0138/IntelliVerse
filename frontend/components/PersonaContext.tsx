"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getStoredPersona, setStoredPersona } from "@/lib/persona";

interface PersonaContextValue {
  persona: string | null;
  setPersona: (p: string | null) => void;
}

const PersonaContext = createContext<PersonaContextValue | null>(null);

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  // Starts null on both server and client to avoid a hydration mismatch,
  // then picks up the real stored value once mounted (same pattern as the
  // guided tour's hasSeenTour check).
  const [persona, setPersonaState] = useState<string | null>(null);

  useEffect(() => {
    // One-time hydration-safe read of localStorage after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPersonaState(getStoredPersona());
  }, []);

  function setPersona(p: string | null) {
    setStoredPersona(p);
    setPersonaState(p);
  }

  return <PersonaContext.Provider value={{ persona, setPersona }}>{children}</PersonaContext.Provider>;
}

export function usePersona(): PersonaContextValue {
  const ctx = useContext(PersonaContext);
  if (!ctx) throw new Error("usePersona must be used within a PersonaProvider");
  return ctx;
}
