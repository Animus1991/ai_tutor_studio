import { cn } from '../../lib/utils';

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
};

/** Full-width page wrapper inside the main column (respects sidebar). */
export default function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn('w-full min-w-0 max-w-none', className)}>
      {children}
    </div>
  );
}

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
