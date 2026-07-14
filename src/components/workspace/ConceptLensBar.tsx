import { useState, useEffect } from 'react';
import { Brain, AlertTriangle, CheckCircle2, Eye } from 'lucide-react';
import {
  subscribeConceptBus,
  getAllConceptEngagements,
  getStrugglingConcepts,
  getMasteredConcepts,
  type ConceptEngagement,
} from '../../lib/workspaceConceptBus';
import type { WorkspaceToolId } from '../../lib/workspaceNoteContent';
import { useLanguage } from '../../lib/i18n';

interface ConceptLensBarProps {
  activeTool: WorkspaceToolId;
  onFocusConcept?: (concept: string) => void;
}

export default function ConceptLensBar({ activeTool, onFocusConcept }: ConceptLensBarProps) {
  const { t } = useLanguage();
  const [engagements, setEngagements] = useState<ConceptEngagement[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setEngagements(getAllConceptEngagements());
    const unsub = subscribeConceptBus(() => {
      setEngagements(getAllConceptEngagements());
    });
    return unsub;
  }, []);

  const struggling = getStrugglingConcepts();
  const mastered = getMasteredConcepts();
  const studiedHere = engagements.filter((e) => e.tools.includes(activeTool));
  const notHere = engagements.filter((e) => !e.tools.includes(activeTool));

  if (engagements.length === 0) return null;

  return (
    <div className="glass-card border-t border-slate-200/60 dark:border-slate-800/60 px-4 py-2">
      <div className="flex items-center gap-3 text-xs">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors"
        >
          <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <span className="font-display font-semibold tracking-tight">{t('Concept Lens', 'Φακός Εννοιών')}</span>
          <span className="text-slate-400 font-normal">({engagements.length})</span>
        </button>

        <div className="flex items-center gap-2 ml-auto">
          {struggling.length > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700/50">
              <AlertTriangle className="w-3 h-3" />
              {struggling.length} {t('struggling', 'δυσκολεύονται')}
            </span>
          )}
          {mastered.length > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/50">
              <CheckCircle2 className="w-3 h-3" />
              {mastered.length} {t('mastered', 'κατακτήθηκαν')}
            </span>
          )}
          {notHere.length > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              <Eye className="w-3 h-3" />
              {notHere.length} {t('not studied here', 'δεν μελετήθηκαν εδώ')}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-2 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto animate-fade-in-up">
          {engagements.slice(0, 30).map((e) => {
            const isHere = e.tools.includes(activeTool);
            const colorClass = e.struggleScore <= -0.3
              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700/50'
              : e.struggleScore >= 0.5
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/50'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';

            return (
              <button
                key={e.concept}
                onClick={() => onFocusConcept?.(e.concept)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all duration-200 hover:shadow-sm card-hover ${colorClass} ${!isHere ? 'opacity-60' : ''}`}
                title={`${e.concept} — ${t('studied in', 'μελετήθηκε σε')} ${e.tools.join(', ')} (${(e.struggleScore * 100).toFixed(0)}%)`}
              >
                {e.concept}
                {e.tools.length > 1 && <span className="ml-1 opacity-60">×{e.tools.length}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
