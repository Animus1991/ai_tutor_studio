import { Play, BookOpen, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';

type Props = {
  courseTitle: string;
  onOpenWorkspace: () => void;
  onViewCourse?: () => void;
  onDismiss: () => void;
  className?: string;
};

/** Post-upload CTA strip — nudge the user to start studying or browse modules. */
export default function PostUploadBanner({
  courseTitle,
  onOpenWorkspace,
  onViewCourse,
  onDismiss,
  className,
}: Props) {
  const { t } = useLanguage();
  return (
    <div
      className={cn(
        'p-4 flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-indigo-200/60 dark:border-indigo-800/40 bg-gradient-to-r from-indigo-50/80 to-violet-50/80 dark:from-indigo-900/20 dark:to-violet-900/20',
        className,
      )}
      role="status"
      data-testid="post-upload-banner"
    >
      <div className="flex-1 min-w-0">
        <p className="section-eyebrow text-indigo-500 dark:text-indigo-400 mb-1">
          {t('Material ready', 'Υλικό έτοιμο')}
        </p>
        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
          {courseTitle}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {t(
            'Open the workspace to start studying, or browse modules.',
            'Άνοιξε τον χώρο εργασίας για μελέτη, ή περιηγήσου στα κεφάλαια.',
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenWorkspace}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 focus-ring"
        >
          <Play className="w-4 h-4" strokeWidth={1.5} />
          {t('Open Workspace', 'Άνοιγμα Χώρου')}
        </button>
        <button
          type="button"
          onClick={onViewCourse ?? onDismiss}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl transition-all hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white focus-ring"
        >
          <BookOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
          {t('Browse Modules', 'Περιήγηση Κεφαλαίων')}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('Dismiss', 'Απόρριψη')}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
