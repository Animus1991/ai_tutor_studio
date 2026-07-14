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
