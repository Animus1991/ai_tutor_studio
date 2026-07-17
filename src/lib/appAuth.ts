// Lightweight client for the FastAPI JWT auth backend (/api/auth/*).
// Cookies (httpOnly) carry the session; we always send credentials.

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: string;
  picture?: string;
}

function formatError(detail: unknown): string {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => (e && typeof (e as { msg?: string }).msg === "string" ? (e as { msg: string }).msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  }
  const msg = (detail as { msg?: string }).msg;
  return typeof msg === "string" ? msg : String(detail);
}

async function req(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`/api/auth${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });
}

async function parse(res: Response): Promise<AppUser> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatError((data as { detail?: unknown }).detail));
  return data as AppUser;
}

export async function login(email: string, password: string): Promise<AppUser> {
  return parse(await req("/login", { method: "POST", body: JSON.stringify({ email, password }) }));
}

export async function register(email: string, password: string, name: string): Promise<AppUser> {
  return parse(await req("/register", { method: "POST", body: JSON.stringify({ email, password, name }) }));
}

export async function me(): Promise<AppUser | null> {
  try {
    const res = await req("/me", { method: "GET" });
    if (!res.ok) return null;
    return (await res.json()) as AppUser;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await req("/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
}

export async function forgotPassword(email: string): Promise<void> {
  await req("/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
}

/** Emergent-managed Google login: exchange the session_id from the redirect for our JWT cookies. */
export async function emergentSession(sessionId: string): Promise<AppUser | null> {
  try {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      credentials: "include",
      headers: { "X-Session-ID": sessionId },
    });
    if (!res.ok) return null;
    return (await res.json()) as AppUser;
  } catch {
    return null;
  }
}

/** Kick off the Emergent Google OAuth redirect. */
export function startGoogleLogin(): void {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const redirectUrl = window.location.origin + "/";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

/** Shape an AppUser into the Firebase-User-like object the app already consumes. */
export function toFirebaseLikeUser(u: AppUser) {
  return {
    uid: u.id,
    email: u.email,
    displayName: u.name,
    photoURL: u.picture || null,
    emailVerified: true,
    isAnonymous: false,
    providerId: "password",
    getIdToken: async () => "",
    getIdTokenResult: async () => ({ claims: { role: u.role } }),
  } as unknown as import("firebase/auth").User;
}
