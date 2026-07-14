import { useState, useCallback } from 'react';
import { Play, Copy, Check, Calculator } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { noteConceptActivity } from '../../lib/workspaceConceptBus';
import WorkspaceToolHeader from './WorkspaceToolHeader';

interface ExtractedFormula { id: string; name: string; formula: string; }
interface ScratchpadPanelProps { formulas: ExtractedFormula[]; }

function tryEvaluate(expr: string): { result: string; ok: boolean } {
  try {
    const cleaned = expr.replace(/[^0-9+\-*/().^%\s]/g, '').replace(/\^/g, '**');
    if (!cleaned.trim()) return { result: '', ok: false };
    // eslint-disable-next-line no-new-func
    const val = new Function(`"use strict"; return (${cleaned})`)();
    if (typeof val === 'number' && !isNaN(val)) return { result: String(val), ok: true };
    return { result: 'Cannot evaluate', ok: false };
  } catch {
    return { result: 'Error', ok: false };
  }
}

export default function ScratchpadPanel({ formulas }: ScratchpadPanelProps) {
  const { t } = useLanguage();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<{ expr: string; result: string }[]>([]);
  const [copied, setCopied] = useState<number | null>(null);

  const evaluate = useCallback(() => {
    if (!input.trim()) return;
    const { result, ok } = tryEvaluate(input);
    if (ok) {
      setHistory((h) => [{ expr: input, result }, ...h].slice(0, 20));
      noteConceptActivity(input.slice(0, 30), 'scratchpad', 'noted');
    }
    setInput('');
  }, [input]);

  const copyFormula = useCallback((idx: number, text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(idx); setTimeout(() => setCopied(null), 1500); });
  }, []);

  return (
    <div className="flex flex-col h-full">
      <WorkspaceToolHeader toolId="scratchpad" />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Detected formulas */}
        <div>
          <h4 className="text-xs font-display font-bold text-slate-500 uppercase mb-2.5 tracking-tight">{t('Formulas from source', 'Τύποι από πηγή')}</h4>
          {formulas.length === 0 ? (
            <p className="text-sm text-slate-400 font-medium">{t('No formulas detected', 'Δεν εντοπίστηκαν τύποι')}</p>
          ) : (
            <div className="space-y-2">
              {formulas.map((f, i) => (
                <div key={f.id} className="flex items-center gap-2 group">
                  <code className="flex-1 text-sm bg-slate-100 dark:bg-slate-800/60 px-3 py-2 rounded-xl font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700" title={f.name}>{f.formula}</code>
                  <button
                    onClick={() => copyFormula(i, f.formula)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-transparent hover:border-slate-300 dark:hover:border-slate-600"
                  >
                    {copied === i ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                  <button
                    onClick={() => setInput(f.formula)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-transparent hover:border-slate-300 dark:hover:border-slate-600"
                    title={t('Load to calculator', 'Φόρτωση στον υπολογιστή')}
                  >
                    <Calculator className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Calculator */}
        <div>
          <h4 className="text-xs font-display font-bold text-slate-500 uppercase mb-2.5 tracking-tight">{t('Calculator', 'Υπολογιστής')}</h4>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && evaluate()}
              placeholder={t('Type expression… (e.g. 2*pi*r)', 'Πληκτρολόγησε… (π.χ. 2*pi*r)')}
              className="flex-1 px-3 py-2.5 text-sm border rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
            <button
              onClick={evaluate}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div>
            <h4 className="text-xs font-display font-bold text-slate-500 uppercase mb-2.5 tracking-tight">{t('History', 'Ιστορικό')}</h4>
            <div className="space-y-1.5">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <code className="text-xs font-mono text-slate-600 dark:text-slate-400">{h.expr}</code>
                  <span className="text-sm font-display font-bold text-indigo-600 dark:text-indigo-400 font-mono">{h.result}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
