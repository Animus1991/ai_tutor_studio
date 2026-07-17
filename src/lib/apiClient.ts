import { getToken } from "firebase/app-check";
import { appCheck, auth } from "./firebase";
import { useAuthStore } from "../store/useAuthStore";
import { DemoModeError, errorFromResponse } from "./apiErrors";

const isApiAuthRequired = import.meta.env.VITE_REQUIRE_API_AUTH === "true";

let authReadyPromise: Promise<void> | null = null;

function ensureAuthReady(): Promise<void> {
  if (!authReadyPromise) {
    authReadyPromise =
      typeof auth.authStateReady === "function"
        ? auth.authStateReady()
        : Promise.resolve();
  }
  return authReadyPromise;
}

function newTraceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tr_${Date.now().toString(36)}`;
}

function getApiPath(input: RequestInfo | URL): string | null {
  if (typeof input === "string") {
    return input.startsWith("/api/")
      ? new URL(input, window.location.origin).pathname
      : null;
  }
  if (input instanceof URL) {
    return input.pathname.startsWith("/api/") ? input.pathname : null;
  }
  const path = new URL(input.url, window.location.origin).pathname;
  return path.startsWith("/api/") ? path : null;
}

function isApiRequest(input: RequestInfo | URL): boolean {
  return getApiPath(input) !== null;
}

function isProtectedApiRequest(input: RequestInfo | URL): boolean {
  const path = getApiPath(input);
  return path !== null && ![
    "/api/health",
    "/api/logs",
    "/api/logs/batch",
    "/api/audit",
  ].includes(path);
}

async function withAuthentication(
  input: RequestInfo | URL,
  init: RequestInit,
  forceRefresh = false,
): Promise<RequestInit> {
  if (!isApiRequest(input)) return init;

  const headers = new Headers(init.headers);
  if (!headers.has("X-Request-Id")) {
    headers.set("X-Request-Id", newTraceId());
  }

  if (auth.currentUser) {
    headers.set(
      "Authorization",
      `Bearer ${await auth.currentUser.getIdToken(forceRefresh)}`,
    );
  }

  if (appCheck) {
    try {
      const { token } = await getToken(appCheck, forceRefresh);
      if (token) headers.set("X-Firebase-AppCheck", token);
    } catch {
      /* App Check optional until enforced */
    }
  }

  return { ...init, headers };
}

/**
 * fetch wrapper that attaches Firebase auth when a user is signed in.
 * Does not throw on non-OK responses — callers handle status themselves.
 */
export async function apiRequest(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  await ensureAuthReady();

  if (
    isApiAuthRequired &&
    useAuthStore.getState().isDemoMode &&
    !auth.currentUser &&
    isProtectedApiRequest(input)
  ) {
    throw new DemoModeError();
  }

  let response = await fetch(input, await withAuthentication(input, init));

  if (response.status === 401 && auth.currentUser && isApiRequest(input)) {
    response = await fetch(
      input,
      await withAuthentication(input, init, true),
    );
  }

  return response;
}

/**
 * Same API as fetch, with a Firebase ID token attached to local API calls.
 * A single forced token refresh is attempted when the server reports 401.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const response = await apiRequest(input, init);

  if (!response.ok) {
    throw await errorFromResponse(response);
  }

  return response;
}
