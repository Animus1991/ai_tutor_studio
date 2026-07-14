import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { cn } from '../../lib/utils';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  confirming?: boolean;
  icon?: ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  confirming = false,
  icon,
}: ConfirmDialogProps) {
  const { t } = useLanguage();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const resolvedConfirmLabel = confirmLabel ?? t('Confirm', 'Επιβεβαίωση');
  const resolvedCancelLabel = cancelLabel ?? t('Cancel', 'Ακύρωση');

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
          role="presentation"
        >
          <motion.button
            type="button"
            aria-label="Close dialog backdrop"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby={description ? 'confirm-dialog-desc' : undefined}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl"
          >
            <div className="flex items-start gap-3 p-5 pb-3">
              {(destructive || icon) && (
                <div className={cn(
                  'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
                  destructive
                    ? 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20'
                    : 'border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-900/20',
                )}>
                  {icon ?? <AlertTriangle className={cn('h-4 w-4', destructive ? 'text-red-500' : 'text-indigo-500')} />}
                </div>
              )}
              <div className="min-w-0 flex-1 pr-6">
                <p className="section-eyebrow mb-1">
                  {t('Confirmation', 'Επιβεβαίωση')}
                </p>
                <h3 id="confirm-dialog-title" className="text-base font-semibold text-slate-900 dark:text-white">
                  {title}
                </h3>
                {description && (
                  <p id="confirm-dialog-desc" className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 dark:border-slate-800 p-4 sm:flex-row sm:justify-end">
              <button
                ref={cancelRef}
                type="button"
                onClick={onClose}
                disabled={confirming}
                className="inline-flex items-center justify-center gap-2 rounded-xl font-medium px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-400 transition-all disabled:opacity-60 disabled:pointer-events-none"
              >
                {resolvedCancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirming}
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold px-5 py-2 text-sm text-white transition-all disabled:opacity-60 disabled:pointer-events-none',
                  destructive
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-indigo-600 hover:bg-indigo-700',
                )}
              >
                {resolvedConfirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
