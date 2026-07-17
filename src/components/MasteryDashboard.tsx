import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useMemo } from 'react';
import { summarizeProfileDomains } from '../lib/learningProfile';
import { useLearningProfileStore } from '../store/useLearningProfileStore';

export default function MasteryDashboard() {
  const profile = useLearningProfileStore((state) => state.profile);

  const data = useMemo(
    () =>
      summarizeProfileDomains(profile).map((entry) => ({
        topic: entry.label,
        mastery: entry.mastery,
        cognitiveLoad: entry.cognitiveLoad,
      })),
    [profile],
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/60 dark:border-slate-800/60 h-full flex flex-col min-h-[350px]">
      <div className="mb-4">
        <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white tracking-tight">
          Mastery vs. Cognitive Load
        </h3>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
          Derived from your local adaptive profile — retrieval success and fatigue
          by knowledge domain.
        </p>
      </div>
      <div className="flex-1 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 20, right: 0, bottom: 0, left: -20 }}
          >
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} opacity={0.2} />
            <XAxis 
              dataKey="topic" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 12 }} 
              dy={10} 
            />
            <YAxis 
              yAxisId="left" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 12 }} 
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 12 }} 
            />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              wrapperClassName="dark:!bg-slate-800 dark:!text-slate-200 !bg-white !text-slate-900"
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Bar 
              yAxisId="left" 
              dataKey="mastery" 
              name="Mastery %" 
              fill="#6366f1" 
              radius={[6, 6, 0, 0]} 
              barSize={24} 
            />
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="cognitiveLoad" 
              name="Cognitive Load %" 
              stroke="#f43f5e" 
              strokeWidth={2} 
              dot={{ r: 4 }} 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
