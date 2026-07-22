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

export async function register(username: string, password: string): Promise<void> {
  setToken(await authRequest("/api/auth/register", username, password));
}
