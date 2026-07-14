import { useState } from 'react';
import { LogIn, LogOut, User as UserIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { googleSignIn, logout, describeAuthError, isCancelledAuthError } from '../lib/auth';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../lib/i18n';
import { cn } from '../lib/utils';

type AuthUserMenuProps = {
  variant?: 'header' | 'sidebar';
};

export default function AuthUserMenu({ variant = 'header' }: AuthUserMenuProps) {
  const { t } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const { setUser, setAccessToken, setNeedsAuth } = useAuthStore();
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    setBusy(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        if (result.accessToken) setAccessToken(result.accessToken);
        setNeedsAuth(false);
        toast.success(
          t('Signed in with Google', 'Σύνδεση με Google'),
        );
      }
      // null → redirect to Google (localhost)
    } catch (err: unknown) {
      if (isCancelledAuthError(err)) return;
      toast.error(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await logout();
      setUser(null);
      setAccessToken(null);
      setNeedsAuth(true);
      toast.success(t('Signed out', 'Αποσύνδεση'));
    } catch {
      toast.error(t('Sign-out failed', 'Η αποσύνδεση απέτυχε'));
    } finally {
      setBusy(false);
    }
  };

  const displayName =
    user?.displayName ||
    user?.email?.split('@')[0] ||
    (isDemoMode ? t('Demo user', 'Demo χρήστης') : t('Guest', 'Επισκέπτης'));

  const subtitle = user?.email
    ? user.email
    : isDemoMode
      ? t('Demo sandbox', 'Demo sandbox')
      : t('Not signed in', 'Χωρίς σύνδεση');

  if (variant === 'sidebar') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center lg:justify-start gap-2 p-2 rounded-xl border border-transparent">
          <div className="relative shrink-0">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="w-8 h-8 rounded-full border border-indigo-200/60 dark:border-indigo-800/50"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50">
                <UserIcon className="w-4 h-4" />
              </div>
            )}
            {user && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
            )}
          </div>
          <div className="hidden lg:block overflow-hidden min-w-0">
            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{displayName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>
          </div>
        </div>
        {user ? (
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={busy}
            className="flex justify-center lg:justify-start items-center gap-2.5 px-3 py-2 w-full rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-sm disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            <span className="hidden lg:block">{t('Sign out', 'Αποσύνδεση')}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleSignIn()}
            disabled={busy}
            className="flex justify-center lg:justify-start items-center gap-2.5 px-3 py-2 w-full rounded-xl font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-sm disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            <span className="hidden lg:block">{t('Sign in with Google', 'Σύνδεση με Google')}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {user && (
        <div className="hidden md:flex items-center gap-2 max-w-[10rem]">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <UserIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            </div>
          )}
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
            {displayName}
          </span>
        </div>
      )}
      {user ? (
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={busy}
          title={t('Sign out', 'Αποσύνδεση')}
          aria-label={t('Sign out', 'Αποσύνδεση')}
          className={cn(
            'h-8 px-3 rounded-full border flex items-center justify-center gap-1.5 text-xs font-semibold transition-all shadow-sm no-print disabled:opacity-50',
            'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600',
          )}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{t('Sign out', 'Αποσύνδεση')}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handleSignIn()}
          disabled={busy}
          title={t('Sign in with Google', 'Σύνδεση με Google')}
          aria-label={t('Sign in with Google', 'Σύνδεση με Google')}
          className={cn(
            'h-8 px-3 rounded-full border flex items-center justify-center gap-1.5 text-xs font-semibold transition-all shadow-sm no-print disabled:opacity-50',
            'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50',
          )}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{t('Sign in', 'Σύνδεση')}</span>
        </button>
      )}
    </div>
  );
}
