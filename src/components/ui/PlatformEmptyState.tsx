import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PlatformEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
  iconColor?: string;
  iconBg?: string;
}

export default function PlatformEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
  iconColor = 'text-slate-400',
  iconBg = 'bg-slate-100 dark:bg-slate-800',
}: PlatformEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in-up rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/60',
        className,
      )}
      data-testid="platform-empty-state"
    >
      <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center mb-5 border border-slate-200/60 dark:border-slate-700/60', iconBg)}>
        <Icon className={cn('w-8 h-8', iconColor)} strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">{description}</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 focus-ring"
          >
            {actionLabel}
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl transition-all hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white focus-ring"
          >
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
