import { useState, useCallback } from 'react';
import { FileText, Sparkles, AlertTriangle, CheckCircle2, Plus, MessageSquare } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { noteConceptActivity } from '../../lib/workspaceConceptBus';
import type { WorkspaceToolId, SourceIntelligence, WorkspaceNoteBundle } from '../../lib/workspaceNoteContent';
import WorkspaceToolHeader from './WorkspaceToolHeader';

interface SourcePanelProps {
  bundle: WorkspaceNoteBundle;
  onSelectTool: (id: WorkspaceToolId) => void;
}

interface Annotation {
  id: string;
  text: string;
  note: string;
  timestamp: number;
}

export default function SourcePanel({ bundle, onSelectTool }: SourcePanelProps) {
  const { t } = useLanguage();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [newNote, setNewNote] = useState('');
  const [selectedText, setSelectedText] = useState('');

  const si = bundle.sourceIntelligence;
  const bandColor = si.band === 'strong' ? 'text-emerald-600' : si.band === 'moderate' ? 'text-amber-600' : 'text-rose-600';
  const bandBg = si.band === 'strong' ? 'bg-emerald-50 dark:bg-emerald-900/20' : si.band === 'moderate' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-rose-50 dark:bg-rose-900/20';

  const addAnnotation = useCallback(() => {
    if (!newNote.trim()) return;
    const ann: Annotation = {
      id: crypto.randomUUID(),
      text: selectedText || '',
      note: newNote.trim(),
      timestamp: Date.now(),
    };
    setAnnotations((a) => [...a, ann]);
    noteConceptActivity(newNote.slice(0, 30), 'source', 'annotated');
    setNewNote('');
    setSelectedText('');
  }, [newNote, selectedText]);

  return (
    <div className="flex flex-col h-full">
      <WorkspaceToolHeader toolId="source" />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Source Intelligence Card */}
        <div className={`rounded-xl ${bandBg} p-4 border border-slate-200/60 dark:border-slate-800/60 shadow-sm`}>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-display font-bold uppercase text-slate-500 flex items-center gap-1.5 tracking-tight">
              <div className="w-5 h-5 rounded bg-white/50 dark:bg-black/20 flex items-center justify-center">
                <Sparkles className="w-3 h-3" />
              </div>
              {t('Source Intelligence', 'Αξιολόγηση Πηγής')}
            </span>
            <span className={`text-sm font-display font-bold ${bandColor} tracking-tight`}>{si.score}/100 · {si.band}</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">{si.reason}</p>

          {si.strengths.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {si.strengths.map((s) => (
                <span key={s} className="text-xs bg-emerald-100 dark:bg-emerald-800/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-200 dark:border-emerald-700/50">
                  <CheckCircle2 className="w-2.5 h-2.5" /> {s}
                </span>
              ))}
            </div>
          )}
          {si.gaps.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {si.gaps.map((g) => (
                <span key={g} className="text-xs bg-amber-100 dark:bg-amber-800/30 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full flex items-center gap-1 border border-amber-200 dark:border-amber-700/50">
                  <AlertTriangle className="w-2.5 h-2.5" /> {g}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={() => onSelectTool(si.bestTool)}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
          >
            <Sparkles className="w-3 h-3" /> {t('Open recommended:', 'Άνοιγμα συνιστώμενου:')} {si.bestTool}
          </button>
        </div>

        {/* Source Quality */}
        {bundle.course?.sourceQuality && (
          <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <h4 className="text-xs font-display font-bold uppercase text-slate-500 mb-2.5 tracking-tight">{t('Course Quality', 'Ποιότητα Μαθήματος')}</h4>
            <p className="text-sm">
              {t('Quality', 'Ποιότητα')}: <span className="font-display font-bold">{bundle.course.sourceQuality.score}/100</span>
              <span className="text-slate-500 ml-1">({bundle.course.sourceQuality.band})</span>
            </p>
            {bundle.course.sourceQuality.warnings.map((w) => (
              <p key={w} className="text-xs text-amber-600 mt-1.5 flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-2.5 h-2.5" />
                </div>
                {w}
              </p>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label={t('Characters', 'Χαρακτήρες')} value={bundle.sourceText.length.toLocaleString()} icon={FileText} />
          <StatCard label={t('Sections', 'Ενότητες')} value={String(bundle.sections.length)} icon={FileText} />
          <StatCard label={t('Flashcards', 'Κάρτες')} value={String(bundle.flashcards.length)} icon={FileText} />
          <StatCard label={t('Formulas', 'Τύποι')} value={String(bundle.formulas.length)} icon={FileText} />
        </div>

        {/* Annotations */}
        <div>
          <h4 className="text-xs font-display font-bold uppercase text-slate-500 mb-2.5 flex items-center gap-1.5 tracking-tight">
            <div className="w-5 h-5 rounded bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <MessageSquare className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            </div>
            {t('Annotations', 'Σημειώσεις')} ({annotations.length})
          </h4>
          {annotations.map((ann) => (
            <div key={ann.id} className="mb-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-3 shadow-sm">
              {ann.text && <p className="text-xs text-indigo-600 dark:text-indigo-400 italic mb-1.5">"{ann.text}"</p>}
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{ann.note}</p>
              <p className="text-xs text-slate-400 mt-1.5 font-medium">{new Date(ann.timestamp).toLocaleTimeString()}</p>
            </div>
          ))}
          <div className="flex gap-2 mt-2.5">
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAnnotation()}
              placeholder={t('Add annotation…', 'Πρόσθεσε σημείωση…')}
              className="flex-1 px-3 py-2 text-xs border rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
            <button onClick={addAnnotation} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof FileText }) {
  return (
    <div className="rounded-xl bg-slate-100 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-700 shadow-sm card-hover">
      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
        <div className="w-4 h-4 rounded bg-white/50 dark:bg-black/20 flex items-center justify-center">
          <Icon className="w-2.5 h-2.5" />
        </div>
        <span className="text-xs uppercase font-display font-bold tracking-tight">{label}</span>
      </div>
      <p className="text-lg font-display font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">{value}</p>
    </div>
  );
}
