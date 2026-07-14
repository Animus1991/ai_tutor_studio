import { Sparkles, X, Upload, LogIn } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { googleSignIn, describeAuthError, isCancelledAuthError } from '../lib/auth';

export default function DemoSandboxBanner() {
  const { isDemoMode, user, setUser, setAccessToken, setNeedsAuth } = useAuthStore();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        const idToken = await result.user.getIdToken();
        setUser(result.user);
        setAccessToken(idToken);
        setNeedsAuth(false);
        toast.success('Signed in — AI features unlocked');
      } else {
        toast.message('Redirecting to Google…');
      }
    } catch (err: unknown) {
      if (isCancelledAuthError(err)) return;
      toast.error(describeAuthError(err));
    } finally {
      setSigningIn(false);
    }
  };

  if (!isDemoMode) return null;

  return (
    <div className="bg-indigo-600 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-sm z-50">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 shrink-0" />
        <span>
          <strong>Demo sandbox active</strong>
          <span className="hidden sm:inline">
            {' '}
            — sample course & stats. Sign in with Google for AI + cloud sync.
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        {!user && (
          <button
            onClick={() => void handleSignIn()}
            disabled={signingIn}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white text-indigo-700 hover:bg-indigo-50 text-xs font-semibold disabled:opacity-50"
          >
            <LogIn className="w-3.5 h-3.5" />
            {signingIn ? 'Signing in…' : 'Sign in with Google'}
          </button>
        )}
        <button
          onClick={() => navigate('/library')}
          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold"
        >
          <Upload className="w-3.5 h-3.5" /> Upload material
        </button>
        <button
          onClick={() => { useAuthStore.getState().exitDemoMode(); navigate('/'); }}
          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold"
        >
          <X className="w-3.5 h-3.5" /> Exit demo
        </button>
      </div>
    </div>
  );
}
