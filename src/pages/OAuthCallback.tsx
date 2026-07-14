import { useEffect } from 'react';

export default function OAuthCallback() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    if (token && window.opener) {
      window.opener.postMessage({ type: 'google-oauth-token', token }, window.location.origin);
      window.close();
    }
  }, []);

  return (
    <div className="h-screen flex items-center justify-center bg-white dark:bg-slate-900">
      <p className="text-slate-500 text-sm">Connecting to Google…</p>
    </div>
  );
}
