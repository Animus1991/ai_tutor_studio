import { auth } from './firebase';
import { isDemoModeActive } from './demoMode';

/** WebSocket base URL for Yjs collab (no trailing slash, no room name). */
export function getCollabWebSocketUrl(): string {
  const configured = import.meta.env.VITE_YJS_WS_URL as string | undefined;
  if (configured) return configured.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/yjs`;
  }

  return 'ws://localhost:3010/yjs';
}

/**
 * Auth params for Yjs WebsocketProvider.
 * Server validates Firebase ID token + room membership when REQUIRE_API_AUTH=true.
 */
export async function getCollabWsParams(): Promise<Record<string, string>> {
  if (isDemoModeActive()) return {};
  await (typeof auth.authStateReady === 'function' ? auth.authStateReady() : Promise.resolve());
  const user = auth.currentUser;
  if (!user) return {};
  try {
    const token = await user.getIdToken();
    return { token };
  } catch {
    return {};
  }
}
