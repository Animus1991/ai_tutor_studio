import { useLanguage } from '../../lib/i18n';
import {
  buildQuizIrtConfidenceBand,
  formatQuizIrtForLearner,
  type QuizIrtDisplay,
} from '../../lib/quizIrt';
import { cn } from '../../lib/utils';

interface QuizIrtBadgeProps {
  irt: QuizIrtDisplay;
  responseCount: number;
  compact?: boolean;
}

const TIER_COLORS = {
  unknown: 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700',
  low: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-700',
  medium: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-700',
  high: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700',
};

const TIER_BAR_COLORS = {
  unknown: 'bg-slate-300 dark:bg-slate-600',
  low: 'bg-rose-400 dark:bg-rose-500',
  medium: 'bg-amber-400 dark:bg-amber-500',
  high: 'bg-emerald-400 dark:bg-emerald-500',
};

export default function QuizIrtBadge({ irt, responseCount, compact }: QuizIrtBadgeProps) {
  const { language } = useLanguage();
  const isGreek = language === 'el';
  const band = buildQuizIrtConfidenceBand(irt, responseCount, isGreek);
  const copy = formatQuizIrtForLearner(irt, isGreek, responseCount);

  if (compact) {
    return (
      <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold', TIER_COLORS[band.tier])}>
        <span>{copy.readinessLabel}</span>
        <span className="opacity-60">·</span>
        <span>{copy.probabilityLabel}</span>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border p-3 mb-3', TIER_COLORS[band.tier])}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold">{copy.readinessLabel}</span>
        <span className="text-xs font-medium opacity-80">{copy.difficultyLabel}</span>
      </div>

      {/* Confidence band bar */}
      <div className="relative h-2 rounded-full bg-white/50 dark:bg-black/20 overflow-hidden mb-1.5">
        <div
          className={cn('absolute top-0 h-full rounded-full opacity-30', TIER_BAR_COLORS[band.tier])}
          style={{ left: `${band.lowPct}%`, width: `${band.highPct - band.lowPct}%` }}
        />
        <div
          className={cn('absolute top-0 h-full w-1.5 rounded-full', TIER_BAR_COLORS[band.tier])}
          style={{ left: `${band.pointPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{band.rangeLabel}</span>
        <span className="text-xs font-semibold tabular-nums">{band.pointPct}%</span>
      </div>

      {copy.hint && (
        <p className="text-xs opacity-70 mt-1 italic">{copy.hint}</p>
      )}
    </div>
  );
}
