import { Maximize2, Minimize2, RotateCcw, HelpCircle } from 'lucide-react';
import { WORKSPACE_TOOLS } from '../../lib/workspaceToolRegistry';
import type { WorkspaceToolId } from '../../lib/workspaceNoteContent';
import { useLanguage } from '../../lib/i18n';

interface WorkspaceToolHeaderProps {
  toolId: WorkspaceToolId;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onReset?: () => void;
  onHelp?: () => void;
  children?: React.ReactNode;
}

const TOOL_DESCRIPTIONS_EL: Record<WorkspaceToolId, string> = {
  'concept-map': 'Οπτικοποίηση εννοιών και προαπαιτούμενων',
  sandbox: 'Διαδραστική εξερεύνηση παραμέτρων',
  leitner: 'Κάρτες επανάληψης με FSRS',
  compare: 'Σύγκριση εννοιών δίπλα-δίπλα',
  whiteboard: 'Σχεδίαση και σημειώσεις με τύπους',
  feynman: 'Εξήγησε με δικά σου λόγια',
  timer: 'Χρονόμετρο μελέτης Pomodoro',
  debate: 'Δέντρο επιχειρημάτων',
  reader: 'Δομημένη ανάγνωση πηγών',
  scratchpad: 'Επίλυση τύπων από σημειώσεις',
  source: 'Σημειώσεις και αξιολόγηση πηγής',
  dashboard: 'Κατάκτηση, ακρίβεια κουίζ και δραστηριότητα',
  quiz: 'Προσαρμοστικό κουίζ με βαθμολόγηση IRT',
};

export default function WorkspaceToolHeader({
  toolId,
  isExpanded,
  onToggleExpand,
  onReset,
  onHelp,
  children,
}: WorkspaceToolHeaderProps) {
  const { t } = useLanguage();
  const tool = WORKSPACE_TOOLS.find((t) => t.id === toolId);
  if (!tool) return null;

  const Icon = tool.icon;

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200/60 dark:border-slate-800/60 glass-card sticky top-0 z-10">
      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
        <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white truncate tracking-tight">
          {t(tool.label, TOOL_DESCRIPTIONS_EL[toolId]?.split(' ')[0] ?? tool.label)}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:block">
          {t(tool.description, TOOL_DESCRIPTIONS_EL[toolId] ?? tool.description)}
        </p>
      </div>

      {children}

      <div className="flex items-center gap-0.5">
        {onReset && (
          <button
            onClick={onReset}
            title={t('Reset', 'Επαναφορά')}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
        {onHelp && (
          <button
            onClick={onHelp}
            title={t('Help', 'Βοήθεια')}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        )}
        {onToggleExpand && (
          <button
            onClick={onToggleExpand}
            title={isExpanded ? t('Minimize', 'Ελαχιστοποίηση') : t('Maximize', 'Μεγιστοποίηση')}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
