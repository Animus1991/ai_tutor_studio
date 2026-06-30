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

import { useOntologyStore } from '../store/useOntologyStore';
import { useMemo } from 'react';

export default function MasteryDashboard() {
  const { nodes } = useOntologyStore();

  const data = useMemo(() => {
    if (!nodes || nodes.length === 0) {
      return [
        { topic: 'Calculus', mastery: 75, cognitiveLoad: 85 },
        { topic: 'Physics', mastery: 60, cognitiveLoad: 90 },
      ];
    }
    
    // Map ontology nodes to chart data, deterministically generating mastery and cognitive load
    // based on the node's properties (to simulate data). In a real app, this would come from a backend or mastery store.
    return nodes.slice(0, 7).map(node => ({
      topic: node.label.length > 12 ? node.label.substring(0, 10) + '...' : node.label,
      mastery: Math.min(100, Math.max(20, node.radius * 3 + (node.group * 10))),
      cognitiveLoad: Math.min(100, Math.max(30, 100 - (node.radius * 2))),
    }));
  }, [nodes]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/60 dark:border-slate-800/60 h-full flex flex-col min-h-[350px]">
      <div className="mb-4">
        <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white tracking-tight">
          Mastery vs. Cognitive Load
        </h3>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
          Analyze topic mastery against perceived difficulty to optimize your study plan.
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
              name="Mastery (%)" 
              fill="#6366f1" 
              radius={[4, 4, 0, 0]} 
              barSize={30} 
            />
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="cognitiveLoad" 
              name="Cognitive Load" 
              stroke="#f43f5e" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff' }} 
              activeDot={{ r: 6 }} 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
