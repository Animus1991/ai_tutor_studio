import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { saveOfflineStudyPack } from '../lib/offlineStudyPack';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'memora_pwa_install_dismissed';

export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    setBusy(true);
    try {
      await saveOfflineStudyPack();
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setVisible(false);
    } finally {
      setBusy(false);
    }
  };

  if (!visible || !deferred) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 shadow-lg p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300">
          <Download className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-900 dark:text-white">Install Memora</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Add to your home screen for offline study. We&apos;ll cache your library pack when you install.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={install}
              disabled={busy}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? 'Preparing…' : 'Install app'}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Not now
            </button>
          </div>
        </div>
        <button type="button" onClick={dismiss} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
