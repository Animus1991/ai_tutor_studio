import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useState, useEffect } from 'react';

const mockData = [
  { day: 'Mon', hours: 2, goal: 3, sessions: 3 },
  { day: 'Tue', hours: 3.5, goal: 3, sessions: 5 },
  { day: 'Wed', hours: 1.5, goal: 3, sessions: 2 },
  { day: 'Thu', hours: 4, goal: 3.5, sessions: 6 },
  { day: 'Fri', hours: 2.5, goal: 3.5, sessions: 4 },
  { day: 'Sat', hours: 5, goal: 4, sessions: 7 },
  { day: 'Sun', hours: 3, goal: 4, sessions: 4 },
];

export default function StudyProgressChart() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setData(mockData);
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-5 shadow-sm h-[320px] flex flex-col animate-pulse">
        <div className="h-6 bg-slate-200 dark:bg-slate-700 w-1/3 rounded mb-2"></div>
        <div className="h-4 bg-slate-100 dark:bg-slate-800 w-1/2 rounded mb-6"></div>
        <div className="flex-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-5 shadow-sm h-[320px] flex flex-col">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight mb-1">
        Study Progress vs Goal
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Study hours over the last 7 days compared to daily goals
      </p>
      <div className="flex-1 w-full min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
            <XAxis 
              dataKey="day" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 12 }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 12 }} 
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              wrapperClassName="dark:!bg-slate-800 dark:!text-slate-200 !bg-white !text-slate-900 !rounded-xl"
            />
            <Area type="monotone" name="Actual Hours" dataKey="hours" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorHours)" />
            <Line type="stepAfter" name="Daily Goal" dataKey="goal" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
