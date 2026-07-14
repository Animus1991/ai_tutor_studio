import { useCallback } from 'react';
import { Keyboard } from 'lucide-react';
import { WORKSPACE_TOOLS, WORKSPACE_TOOL_GROUPS, type WorkspaceToolDef } from '../../lib/workspaceToolRegistry';
import type { WorkspaceToolId } from '../../lib/workspaceNoteContent';
import { useLanguage } from '../../lib/i18n';

interface WorkspaceDockProps {
  activeTool: WorkspaceToolId;
  onSelectTool: (id: WorkspaceToolId) => void;
  onShowKeyboardHelp?: () => void;
  conceptBusCounts?: Record<string, number>;
}

const TOOL_LABELS_EL: Record<WorkspaceToolId, string> = {
  'concept-map': 'Χάρτης',
  sandbox: 'Sandbox',
  leitner: 'Κάρτες',
  compare: 'Σύγκριση',
  whiteboard: 'Πίνακας',
  feynman: 'Feynman',
  timer: 'Χρόνος',
  debate: 'Debate',
  reader: 'Αναγνώστης',
  scratchpad: 'Μαθηματικά',
  source: 'Πηγή',
  dashboard: 'Πρόοδος',
  quiz: 'Κουίζ',
};

function DockButton({
  tool,
  isActive,
  onClick,
  badge,
}: {
  tool: WorkspaceToolDef;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}) {
  const { t } = useLanguage();
  const Icon = tool.icon;

  return (
    <button
      onClick={onClick}
      title={`${t(tool.label, TOOL_LABELS_EL[tool.id] ?? tool.label)} (${tool.shortcut})`}
      aria-pressed={isActive}
      className={`relative flex flex-col items-center gap-1.5 px-2.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
        isActive
          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-800/50'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-slate-200 border border-transparent'
      }`}
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
        isActive
          ? 'bg-indigo-100 dark:bg-indigo-800/40'
          : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200'
      }`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <span className="leading-none">{t(tool.shortLabel, TOOL_LABELS_EL[tool.id] ?? tool.shortLabel)}</span>
      {badge != null && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 px-0.5 bg-rose-500 text-white text-xs leading-none rounded-full flex items-center justify-center font-bold ring-2 ring-white dark:ring-slate-900">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

export default function WorkspaceDock({ activeTool, onSelectTool, onShowKeyboardHelp, conceptBusCounts }: WorkspaceDockProps) {
  const { t } = useLanguage();

  const handleSelect = useCallback(
    (id: WorkspaceToolId) => onSelectTool(id),
    [onSelectTool],
  );

  return (
    <div className="flex flex-col h-full glass-card border-r border-slate-200/60 dark:border-slate-800/60 py-3 px-2 w-[5.25rem] overflow-y-auto">
      {WORKSPACE_TOOL_GROUPS.map((group, gi) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          {gi > 0 && <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent mx-2 my-2" />}
          <span className="text-xs uppercase font-bold text-slate-400 dark:text-slate-500 text-center tracking-wider mb-1.5 font-sans leading-tight">
            {group.label}
          </span>
          {group.tools.map((toolId) => {
            const tool = WORKSPACE_TOOLS.find((t) => t.id === toolId);
            if (!tool) return null;
            return (
              <DockButton
                key={tool.id}
                tool={tool}
                isActive={activeTool === tool.id}
                onClick={() => handleSelect(tool.id)}
                badge={conceptBusCounts?.[tool.id]}
              />
            );
          })}
        </div>
      ))}

      <div className="mt-auto pt-3">
        <button
          onClick={onShowKeyboardHelp}
          title={t('Keyboard shortcuts (?)', 'Συντομεύσεις (?)')}
          className="flex flex-col items-center gap-1.5 px-2.5 py-2.5 rounded-xl text-xs text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all duration-200 w-full border border-transparent hover:border-indigo-100 dark:hover:border-indigo-800/40"
        >
          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Keyboard className="w-3.5 h-3.5" />
          </div>
          <span>?</span>
        </button>
      </div>
    </div>
  );
}
