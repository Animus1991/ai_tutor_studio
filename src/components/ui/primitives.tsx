import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Reusable UI primitives for ai_tutor_studio.
 * Inspired by synapse-learning's component library but adapted
 * to the indigo-based, glassmorphic style of this project.
 */

/* ─── Page wrapper ─── */
export function Page({
  children,
  className,
  gap = 'md',
}: {
  children: ReactNode;
  className?: string;
  gap?: 'sm' | 'md' | 'lg';
}) {
  const gapClass = gap === 'sm' ? 'space-y-4' : gap === 'lg' ? 'space-y-8' : 'space-y-6';
  return (
    <div className={cn('w-full min-w-0 pb-8', gapClass, className)}>
      {children}
    </div>
  );
}

/* ─── PageHeader ─── */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  actions,
  className,
  animate = true,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
  animate?: boolean;
}) {
  const content = (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="section-eyebrow mb-1">{eyebrow}</p>}
        <div className="flex items-center gap-3">
          {Icon && (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <h1 className="text-xl font-display font-bold tracking-tight text-slate-900 dark:text-white truncate">{title}</h1>
        </div>
        {subtitle && <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );

  if (!animate) return content;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {content}
    </motion.div>
  );
}

/* ─── SectionHeader ─── */
export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  className,
  animate = true,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  animate?: boolean;
}) {
  const body = (
    <div className={cn('space-y-1.5', className)}>
      {eyebrow && <p className="section-eyebrow">{eyebrow}</p>}
      <h2 className="font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h2>
      {subtitle && <p className="max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>}
    </div>
  );
  if (!animate) return body;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      {body}
    </motion.div>
  );
}

/* ─── Card ─── */
const CARD_TONE = {
  default: 'bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/60',
  muted: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/40 dark:border-slate-700/40',
  brand: 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200/60 dark:border-indigo-800/40',
  danger: 'bg-red-50/50 dark:bg-red-900/10 border-red-200/60 dark:border-red-800/40',
  success: 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/60 dark:border-emerald-800/40',
} as const;

export function Card({
  children,
  className,
  tone = 'default',
  padding = 'md',
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  tone?: keyof typeof CARD_TONE;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}) {
  const padClass = padding === 'none' ? '' : padding === 'sm' ? 'p-4' : padding === 'lg' ? 'p-6' : 'p-5';
  return (
    <div className={cn(
      'rounded-2xl border shadow-sm',
      CARD_TONE[tone],
      padClass,
      interactive && 'cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-700',
      className,
    )}>
      {children}
    </div>
  );
}

/* ─── AnimatedCard ─── */
export function AnimatedCard({
  children,
  className,
  tone = 'default',
  padding = 'md',
  delay = 0,
  animate = true,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  tone?: keyof typeof CARD_TONE;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  delay?: number;
  animate?: boolean;
  interactive?: boolean;
}) {
  const card = (
    <Card tone={tone} padding={padding} className={className} interactive={interactive}>
      {children}
    </Card>
  );
  if (!animate) return card;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {card}
    </motion.div>
  );
}

/* ─── StatTile ─── */
export function StatTile({
  icon,
  label,
  value,
  hint,
  className,
}: {
  icon?: ReactNode;
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('ux-stat-tile', className)}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="section-eyebrow text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </Card>
  );
}

/* ─── SectionHeading ─── */
export function SectionHeading({
  title,
  icon: Icon,
  iconClassName,
  action,
  size = 'sm',
  className,
}: {
  title: ReactNode;
  icon?: LucideIcon;
  iconClassName?: string;
  action?: ReactNode;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <h2 className={cn(
        'flex items-center gap-2 font-semibold text-slate-900 dark:text-white',
        size === 'lg' ? 'text-lg font-display font-bold' : 'text-sm',
      )}>
        {Icon && <Icon className={cn('shrink-0 text-indigo-600 dark:text-indigo-400', size === 'lg' ? 'h-5 w-5' : 'h-4 w-4', iconClassName)} />}
        {title}
      </h2>
      {action}
    </div>
  );
}

/* ─── TabBar ─── */
export type TabItem = {
  key: string;
  label: ReactNode;
  icon?: LucideIcon;
};

export function TabBar({
  tabs,
  activeKey,
  onChange,
  ariaLabel,
  className,
}: {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl', className)} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeKey === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={cn(
              'flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors',
              active
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── PrimaryCTA ─── */
export const PrimaryCTA = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'sm' | 'md' }
>(function PrimaryCTA({ children, className, size = 'md', ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all duration-300',
        'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:pointer-events-none shadow-sm hover:shadow-md',
        size === 'sm' ? 'px-4 py-2 text-xs' : 'px-5 py-2.5 text-sm',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

/* ─── SecondaryCTA ─── */
export const SecondaryCTA = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'sm' | 'md' }
>(function SecondaryCTA({ children, className, size = 'md', ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-300',
        'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300',
        'hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-400',
        'disabled:opacity-60 disabled:pointer-events-none',
        size === 'sm' ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

/* ─── UxCallout ─── */
export type CalloutVariant = 'trust' | 'danger' | 'info' | 'warn' | 'next-action';

const CALLOUT_STYLES: Record<CalloutVariant, string> = {
  trust: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-200',
  danger: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-200',
  info: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-200',
  warn: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-200',
  'next-action': 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800/50 text-indigo-800 dark:text-indigo-200',
};

export function UxCallout({
  variant,
  title,
  children,
  icon,
  action,
  className,
}: {
  variant: CalloutVariant;
  title?: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border p-4 flex items-start gap-3', CALLOUT_STYLES[variant], className)} role="status">
      {icon && <span className="mt-0.5 shrink-0 [&>svg]:h-5 [&>svg]:w-5" aria-hidden>{icon}</span>}
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-semibold mb-1">{title}</p>}
        <div className="text-sm leading-relaxed">{children}</div>
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
