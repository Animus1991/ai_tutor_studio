import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  className?: string;
  titleClassName?: string;
  titleId?: string;
  subtitleId?: string;
};

/** Reusable modal header — eyebrow → title → subtitle stack. */
export function ModalHeaderStack({
  eyebrow,
  title,
  subtitle,
  className,
  titleClassName,
  titleId,
  subtitleId,
}: Props) {
  return (
    <div className={cn(className)}>
      {eyebrow && <p className="section-eyebrow mb-1">{eyebrow}</p>}
      <h2
        id={titleId}
        className={cn('text-lg font-bold text-slate-900 dark:text-white', titleClassName)}
      >
        {title}
      </h2>
      {subtitle && (
        <p id={subtitleId} className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
