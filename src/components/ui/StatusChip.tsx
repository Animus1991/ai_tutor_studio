import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type StatusChipVariant = 'info' | 'warn' | 'error' | 'success' | 'mastered' | 'weak' | 'due' | 'exam';

const VARIANT_CLASS: Record<StatusChipVariant, string> = {
  info: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  warn: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  error: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  success: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  mastered: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  weak: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  due: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  exam: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
};

type Props = {
  children: ReactNode;
  variant?: StatusChipVariant;
  className?: string;
};

/** Semantic status pill — task priority, quiz state, mastery level, etc. */
export function StatusChip({ children, variant = 'info', className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border',
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
