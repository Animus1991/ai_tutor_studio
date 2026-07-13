import { useState } from 'react';
import { ArrowLeftRight, Search } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { noteConceptActivity } from '../../lib/workspaceConceptBus';
import type { ComparisonRow } from '../../lib/noteContentExtractors';
import WorkspaceToolHeader from './WorkspaceToolHeader';

interface ComparePanelProps { comparisons: ComparisonRow[]; }

export default function ComparePanel({ comparisons }: ComparePanelProps) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState('');
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);

  const filtered = filter
    ? comparisons.filter((r) =>
        r.left.toLowerCase().includes(filter.toLowerCase()) ||
        r.right.toLowerCase().includes(filter.toLowerCase()) ||
        r.dimension.toLowerCase().includes(filter.toLowerCase()))
    : comparisons;

  if (!comparisons.length) return null;

  return (
    <div className="flex flex-col h-full">
      <WorkspaceToolHeader toolId="compare">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('Filter…', 'Φίλτρο…')}
            className="pl-8 pr-3 py-1.5 text-xs border rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 w-36 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
          />
        </div>
      </WorkspaceToolHeader>
      <div className="flex-1 overflow-auto p-5">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200/60 dark:border-slate-800/60">
              <th className="text-left py-3 pr-4 text-xs font-display font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">{t('Concept A', 'Έννοια Α')}</th>
              <th className="px-2 py-3"><ArrowLeftRight className="w-4 h-4 text-slate-400 mx-auto" /></th>
              <th className="text-left py-3 pr-4 text-xs font-display font-bold text-purple-600 dark:text-purple-400 tracking-tight">{t('Concept B', 'Έννοια Β')}</th>
              <th className="text-left py-3 text-xs font-display font-bold text-slate-500 tracking-tight">{t('Dimension', 'Διάσταση')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr
                key={i}
                onClick={() => {
                  setHighlightedRow(i === highlightedRow ? null : i);
                  noteConceptActivity(r.left, 'compare', 'read');
                }}
                className={`border-b border-slate-100 dark:border-slate-800/60 cursor-pointer transition-colors ${
                  highlightedRow === i ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <td className="py-3 pr-4 text-sm text-slate-900 dark:text-white font-medium">{r.left}</td>
                <td className="px-2 py-3 text-center text-slate-400 font-medium">vs</td>
                <td className="py-3 pr-4 text-sm text-slate-900 dark:text-white font-medium">{r.right}</td>
                <td className="py-3 text-xs text-slate-500">{r.dimension}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && filter && (
          <p className="text-center text-sm text-slate-400 mt-8 font-medium">{t('No matches', 'Δεν βρέθηκαν αποτελέσματα')}</p>
        )}
      </div>
    </div>
  );
}
