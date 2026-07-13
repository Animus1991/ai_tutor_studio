import { auth } from "./firebase";
import { useAuthStore } from "../store/useAuthStore";
import { DemoModeError, errorFromResponse } from "./apiErrors";

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
  return path !== null && !["/api/health", "/api/logs", "/api/logs/batch"].includes(path);
}

async function withAuthentication(
  input: RequestInfo | URL,
  init: RequestInit,
  forceRefresh = false,
): Promise<RequestInit> {
  if (!isApiRequest(input) || !auth.currentUser) return init;

  const headers = new Headers(init.headers);
  headers.set(
    "Authorization",
    `Bearer ${await auth.currentUser.getIdToken(forceRefresh)}`,
  );
  return { ...init, headers };
}

/**
 * Same API as fetch, with a Firebase ID token attached to local API calls.
 * A single forced token refresh is attempted when the server reports 401.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  if (
    useAuthStore.getState().isDemoMode &&
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

  if (!response.ok) {
    throw await errorFromResponse(response);
  }

  return response;
}
