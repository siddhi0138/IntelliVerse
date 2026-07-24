// Suggestions shown in the persona field's autocomplete list — not an
// exhaustive/enforced set. Typing anything else works exactly the same;
// these are just a head start for the common cases.
export const PERSONA_SUGGESTIONS = [
  "Business Owner",
  "HR Manager",
  "Sales Manager",
  "Teacher",
  "Student",
  "Doctor",
  "Financial Analyst",
  "Marketing Manager",
] as const;

const PERSONA_KEY = "nexus_persona";

export function getStoredPersona(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PERSONA_KEY) || null;
}

export function setStoredPersona(persona: string | null): void {
  const trimmed = persona?.trim();
  if (trimmed) localStorage.setItem(PERSONA_KEY, trimmed);
  else localStorage.removeItem(PERSONA_KEY);
}
