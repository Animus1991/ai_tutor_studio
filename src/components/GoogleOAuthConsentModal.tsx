import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, FileText, Video, CheckCircle2, Loader2 } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import type { GoogleOAuthScopes } from '../hooks/useGoogleOAuth';

interface Props {
  open: boolean;
  scopes: GoogleOAuthScopes[];
  isPending: boolean;
  isConnected: boolean;
  onConnect: () => void;
  onRevoke: () => void;
  onClose: () => void;
}

const SCOPE_META: Record<GoogleOAuthScopes, { icon: React.ReactNode; label: string; labelEl: string; desc: string; descEl: string }> = {
  forms: {
    icon: <FileText className="w-4 h-4 text-indigo-600" />,
    label: 'Create Google Forms',
    labelEl: 'Δημιουργία Google Forms',
    desc: 'Generate quizzes as real Google Forms',
    descEl: 'Δημιουργία quiz ως Google Forms',
  },
  meet: {
    icon: <Video className="w-4 h-4 text-emerald-600" />,
    label: 'Create Google Meet spaces',
    labelEl: 'Δημιουργία χώρων Meet',
    desc: 'Start real Meet sessions for your group',
    descEl: 'Έναρξη πραγματικών συνεδριών Meet',
  },
  classroom: {
    icon: <Shield className="w-4 h-4 text-amber-600" />,
    label: 'Read Google Classroom',
    labelEl: 'Ανάγνωση Classroom',
    desc: 'Import your courses from Google Classroom',
    descEl: 'Εισαγωγή μαθημάτων από Classroom',
  },
};

export default function GoogleOAuthConsentModal({ open, scopes, isPending, isConnected, onConnect, onRevoke, onClose }: Props) {
  const { t } = useLanguage();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="google-oauth-title"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/60 dark:border-slate-800/60 w-full max-w-sm p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <h2 id="google-oauth-title" className="text-base font-semibold text-slate-900 dark:text-white">
                  {t('Connect Google Account', 'Σύνδεση Google')}
                </h2>
              </div>
              <button onClick={onClose} aria-label={t('Close', 'Κλείσιμο')} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {t('Memora needs the following permissions:', 'Ο Memora χρειάζεται τα παρακάτω δικαιώματα:')}
            </p>

            <ul className="space-y-2.5 mb-6">
              {scopes.map((s) => {
                const meta = SCOPE_META[s];
                return (
                  <li key={s} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <span className="mt-0.5 shrink-0">{meta.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{t(meta.label, meta.labelEl)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t(meta.desc, meta.descEl)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            {isConnected ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-3">
                  <CheckCircle2 className="w-4 h-4" />
                  {t('Google account connected', 'Google συνδεδεμένο')}
                </div>
                <button
                  onClick={onRevoke}
                  className="w-full py-2 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-medium hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                >
                  {t('Disconnect', 'Αποσύνδεση')}
                </button>
              </div>
            ) : (
              <button
                onClick={onConnect}
                disabled={isPending}
                className="w-full py-2.5 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 dark:hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />{t('Connecting…', 'Σύνδεση…')}</>
                ) : (
                  t('Connect with Google', 'Σύνδεση με Google')
                )}
              </button>
            )}

            <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-3">
              {t('Tokens are stored locally and never sent to our servers.', 'Τα tokens αποθηκεύονται τοπικά.')}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
