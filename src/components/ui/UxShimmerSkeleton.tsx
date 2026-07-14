import type { CSSProperties } from 'react';
import { cn } from '../../lib/utils';

type SkeletonProps = {
  className?: string;
  style?: CSSProperties;
};

/** Single shimmer bar — loading placeholder animation. */
export function UxShimmerSkeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn('ux-shimmer', className)}
      style={style}
      aria-hidden
    />
  );
}

type PanelProps = {
  lines?: number;
  className?: string;
};

/** Stacked shimmer lines for panel/chart/modal loading placeholders. */
export function UxShimmerPanel({ lines = 4, className }: PanelProps) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-live="polite">
      {Array.from({ length: lines }, (_, i) => (
        <UxShimmerSkeleton
          key={i}
          className="h-3 rounded-md"
          style={{ width: `${Math.max(55, 100 - i * 10)}%` }}
        />
      ))}
    </div>
  );
}

/** Full-screen lazy-load overlay skeleton. */
export function LazyOverlaySkeleton() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-6"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-xl">
        <UxShimmerSkeleton className="h-5 w-40 rounded-lg" />
        <UxShimmerPanel lines={5} />
        <div className="flex gap-2 pt-2">
          <UxShimmerSkeleton className="h-9 w-24 rounded-lg" />
          <UxShimmerSkeleton className="h-9 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
