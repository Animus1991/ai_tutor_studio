import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Shield, Swords } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { noteConceptActivity } from '../../lib/workspaceConceptBus';
import type { DebateNode } from '../../lib/noteContentExtractors';
import WorkspaceToolHeader from './WorkspaceToolHeader';

interface DebatePanelProps { debateNodes: DebateNode[]; }

export default function DebatePanel({ debateNodes }: DebatePanelProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [userCounters, setUserCounters] = useState<Map<string, string[]>>(new Map());
  const [input, setInput] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const addCounter = useCallback((nodeId: string) => {
    if (!input.trim()) return;
    setUserCounters((p) => { const n = new Map(p); n.set(nodeId, [...(n.get(nodeId) ?? []), input.trim()]); return n; });
    noteConceptActivity(input.trim().slice(0, 40), 'debate', 'mapped');
    setInput(''); setActiveId(null);
  }, [input]);

  if (!debateNodes.length) return null;

  return (
    <div className="flex flex-col h-full">
      <WorkspaceToolHeader toolId="debate" />
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {debateNodes.map((node) => {
          const open = expanded.has(node.id);
          const uArgs = userCounters.get(node.id) ?? [];
          return (
            <div key={node.id} className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 overflow-hidden shadow-sm card-hover">
              <button onClick={() => toggle(node.id)} className="w-full flex items-start gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-colors">
                {open ? <ChevronDown className="w-4 h-4 mt-0.5 text-slate-400" /> : <ChevronRight className="w-4 h-4 mt-0.5 text-slate-400" />}
                <div className="flex-1">
                  <p className="text-sm font-display font-semibold text-slate-900 dark:text-white tracking-tight">{node.claim}</p>
                  <div className="flex gap-2 mt-1.5 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><div className="w-4 h-4 rounded bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center"><Shield className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" /></div> {node.support.length}</span>
                    <span className="flex items-center gap-1"><div className="w-4 h-4 rounded bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center"><Swords className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" /></div> {node.counter.length + uArgs.length}</span>
                  </div>
                </div>
              </button>
              {open && (
                <div className="border-t border-slate-100 dark:border-slate-800 p-4 space-y-3">
                  {node.support.length > 0 && (
                    <div>
                      <h5 className="text-xs font-display font-bold uppercase text-emerald-600 mb-1.5 tracking-tight">{t('Support', 'Υποστήριξη')}</h5>
                      {node.support.map((s, i) => <p key={i} className="text-xs text-slate-600 dark:text-slate-400 pl-3 border-l-2 border-emerald-200 dark:border-emerald-700/50 leading-relaxed">{s}</p>)}
                    </div>
                  )}
                  {(node.counter.length > 0 || uArgs.length > 0) && (
                    <div>
                      <h5 className="text-xs font-display font-bold uppercase text-rose-600 mb-1.5 tracking-tight">{t('Counter', 'Αντεπιχείρημα')}</h5>
                      {node.counter.map((c, i) => <p key={i} className="text-xs text-slate-600 dark:text-slate-400 pl-3 border-l-2 border-rose-200 dark:border-rose-700/50 leading-relaxed">{c}</p>)}
                      {uArgs.map((c, i) => <p key={`u${i}`} className="text-xs text-indigo-600 dark:text-indigo-400 pl-3 border-l-2 border-indigo-200 dark:border-indigo-700/50 leading-relaxed font-medium">{c}</p>)}
                    </div>
                  )}
                  {activeId === node.id ? (
                    <div className="flex gap-2">
                      <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCounter(node.id)}
                        placeholder={t('Your counterargument…', 'Το αντεπιχείρημά σου…')}
                        className="flex-1 px-3 py-2 text-xs border rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all" />
                      <button onClick={() => addCounter(node.id)} className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all shadow-sm">{t('Add', 'Προσθήκη')}</button>
                    </div>
                  ) : (
                    <button onClick={() => setActiveId(node.id)} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                      + {t('Add counter-argument', 'Πρόσθεσε αντεπιχείρημα')}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
