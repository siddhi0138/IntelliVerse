const TOKEN_KEY = "nexus_token";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// Reads the "sub" claim straight out of the JWT payload — display-only, so
// this doesn't verify the signature (the backend already did that).
export function getUsername(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json).sub ?? null;
  } catch {
    return null;
  }
}

// Browsers share localStorage across every account that ever signs in on
// them — a plain key like "nexus_last_analysis" leaks straight from one
// user's session into the next person who logs in on the same machine.
// Suffixing every per-user key with the username keeps each account's state
// independent without needing to wipe it on sign-out (so the same user
// signing back in still finds their own last dataset / tour progress).
export function userScopedKey(key: string): string {
  const username = getUsername();
  return username ? `${key}:${username}` : key;
}

async function authRequest(path: string, username: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.detail ?? `Request failed with status ${res.status}`);
  }
  return body.access_token as string;
}

export async function login(username: string, password: string): Promise<void> {
  setToken(await authRequest("/api/auth/login", username, password));
}

// Deliberately doesn't call setToken: registering creates the account but
// shouldn't auto-sign-in — the user lands back on the login form and signs
// in explicitly, so "register" and "login" are always two distinct steps.
export async function register(username: string, password: string): Promise<void> {
  await authRequest("/api/auth/register", username, password);
}
