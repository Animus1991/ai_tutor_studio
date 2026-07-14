import { useState, useMemo } from 'react';
import { BarChart3, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { noteConceptActivity } from '../../lib/workspaceConceptBus';
import WorkspaceToolHeader from './WorkspaceToolHeader';

interface ExtractedFormula { id: string; name: string; formula: string; }
interface SimulatorPanelProps {
  sandboxInsight: string;
  economicsSandbox: boolean;
  formulas: ExtractedFormula[];
}

interface ParamDef {
  label: string;
  labelEl: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: string;
}

const ECON_PARAMS: ParamDef[] = [
  { label: 'Price', labelEl: 'Τιμή', min: 0, max: 200, step: 1, defaultValue: 50, unit: '€' },
  { label: 'Quantity', labelEl: 'Ποσότητα', min: 0, max: 1000, step: 10, defaultValue: 100, unit: '' },
  { label: 'Cost', labelEl: 'Κόστος', min: 0, max: 100, step: 1, defaultValue: 30, unit: '€' },
  { label: 'Elasticity', labelEl: 'Ελαστικότητα', min: 0.1, max: 3, step: 0.1, defaultValue: 1.0, unit: '' },
];

export default function SimulatorPanel({ sandboxInsight, economicsSandbox, formulas }: SimulatorPanelProps) {
  const { t } = useLanguage();
  const [params, setParams] = useState<Record<string, number>>(
    Object.fromEntries(ECON_PARAMS.map((p) => [p.label, p.defaultValue]))
  );

  const results = useMemo(() => {
    const price = params['Price'] ?? 50;
    const qty = params['Quantity'] ?? 100;
    const cost = params['Cost'] ?? 30;
    const elasticity = params['Elasticity'] ?? 1;

    const revenue = price * qty;
    const totalCost = cost * qty;
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const adjustedDemand = qty * Math.pow(price / 50, -elasticity);

    return { revenue, totalCost, profit, margin, adjustedDemand };
  }, [params]);

  const handleChange = (key: string, val: number) => {
    setParams((p) => ({ ...p, [key]: val }));
    noteConceptActivity(key, 'sandbox', 'simulated');
  };

  const reset = () => setParams(Object.fromEntries(ECON_PARAMS.map((p) => [p.label, p.defaultValue])));

  return (
    <div className="flex flex-col h-full">
      <WorkspaceToolHeader toolId="sandbox" onReset={reset} />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Insight */}
        <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-4 border border-indigo-100 dark:border-indigo-800/50 shadow-sm">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{sandboxInsight || t('Adjust parameters below to explore relationships.', 'Ρύθμισε τις παραμέτρους για να εξερευνήσεις σχέσεις.')}</p>
        </div>

        {/* Parameters */}
        {economicsSandbox && (
          <div className="space-y-4">
            <h4 className="text-xs font-display font-bold text-slate-500 uppercase tracking-tight">{t('Parameters', 'Παράμετροι')}</h4>
            {ECON_PARAMS.map((p) => (
              <div key={p.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t(p.label, p.labelEl)}</label>
                  <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-medium">
                    {(params[p.label] ?? p.defaultValue).toFixed(p.step < 1 ? 1 : 0)}{p.unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={params[p.label] ?? p.defaultValue}
                  onChange={(e) => handleChange(p.label, parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 h-1.5 rounded-full"
                />
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {economicsSandbox && (
          <div className="space-y-3">
            <h4 className="text-xs font-display font-bold text-slate-500 uppercase tracking-tight">{t('Results', 'Αποτελέσματα')}</h4>
            <div className="grid grid-cols-2 gap-3">
              <ResultCard label={t('Revenue', 'Έσοδα')} value={`€${results.revenue.toLocaleString()}`} icon={BarChart3} color="indigo" />
              <ResultCard label={t('Total Cost', 'Συνολικό Κόστος')} value={`€${results.totalCost.toLocaleString()}`} icon={BarChart3} color="slate" />
              <ResultCard
                label={t('Profit', 'Κέρδος')}
                value={`€${results.profit.toLocaleString()}`}
                icon={results.profit >= 0 ? TrendingUp : TrendingDown}
                color={results.profit >= 0 ? 'emerald' : 'rose'}
              />
              <ResultCard label={t('Margin', 'Περιθώριο')} value={`${results.margin.toFixed(1)}%`} icon={BarChart3} color="purple" />
            </div>
          </div>
        )}

        {/* Detected formulas */}
        {formulas.length > 0 && (
          <div>
            <h4 className="text-xs font-display font-bold text-slate-500 uppercase mb-2.5 tracking-tight">{t('Source formulas', 'Τύποι πηγής')}</h4>
            {formulas.map((f) => (
              <code key={f.id} className="block text-sm bg-slate-100 dark:bg-slate-800/60 px-3 py-2 rounded-xl font-mono mb-2 border border-slate-200 dark:border-slate-700" title={f.name}>{f.formula}</code>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: typeof BarChart3; color: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50',
    rose: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50',
    purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/50',
    slate: 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  };
  return (
    <div className={`rounded-xl p-3 border shadow-sm card-hover ${colors[color] ?? colors.slate}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-5 h-5 rounded bg-white/50 dark:bg-black/20 flex items-center justify-center">
          <Icon className="w-3 h-3" />
        </div>
        <span className="text-xs font-display font-semibold uppercase tracking-tight">{label}</span>
      </div>
      <p className="text-lg font-display font-bold font-mono tracking-tight">{value}</p>
    </div>
  );
}
