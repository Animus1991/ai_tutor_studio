import { useState, useEffect, useCallback, useRef } from 'react';
import firebaseConfig from '../../firebase-applet-config.json';

const STORAGE_KEY = 'memora-google-oauth-token';
const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 620;

export type GoogleOAuthScopes = 'forms' | 'meet' | 'classroom';

const SCOPE_MAP: Record<GoogleOAuthScopes, string> = {
  forms: 'https://www.googleapis.com/auth/forms.body',
  meet: 'https://www.googleapis.com/auth/meetings.space.created',
  classroom: 'https://www.googleapis.com/auth/classroom.courses.readonly',
};

function resolveGoogleClientId(): string {
  const fromEnv = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
  if (fromEnv) return fromEnv;
  return String((firebaseConfig as { oAuthClientId?: string }).oAuthClientId ?? '').trim();
}

function buildAuthUrl(scopes: GoogleOAuthScopes[], redirectUri: string): string {
  const clientId = resolveGoogleClientId();
  const scopeStr = scopes.map((s) => SCOPE_MAP[s]).join(' ');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: scopeStr,
    include_granted_scopes: 'true',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function getCallbackOrigin(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/oauth/callback`;
}

export interface GoogleOAuthState {
  token: string | null;
  isConnected: boolean;
  isPending: boolean;
  request: (scopes: GoogleOAuthScopes[]) => void;
  revoke: () => void;
}

export function useGoogleOAuth(): GoogleOAuthState {
  const [token, setToken] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [isPending, setIsPending] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'google-oauth-token' && typeof e.data.token === 'string') {
        const t = e.data.token as string;
        setToken(t);
        try { localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
        setIsPending(false);
        popupRef.current?.close();
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const request = useCallback((scopes: GoogleOAuthScopes[]) => {
    const redirectUri = getCallbackOrigin();
    const url = buildAuthUrl(scopes, redirectUri);
    const left = window.screenX + (window.outerWidth - POPUP_WIDTH) / 2;
    const top = window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2;
    const popup = window.open(
      url,
      'google-oauth-popup',
      `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},toolbar=no,menubar=no`,
    );
    if (!popup) return;
    popupRef.current = popup;
    setIsPending(true);
    timerRef.current = setInterval(() => {
      if (popup.closed) {
        setIsPending(false);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 500);
  }, []);

  const revoke = useCallback(() => {
    setToken(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return { token, isConnected: !!token, isPending, request, revoke };
}
