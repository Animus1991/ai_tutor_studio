import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';

export default function StudyProgressChart() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const history = useStore(state => state.studySessionsHistory);
  const dailyGoal = useStore(state => state.dailyGoal) / 60; // in hours

  useEffect(() => {
    // Generate real data for the last 7 days
    const chartData = Array.from({ length: 7 }).map((_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayHistory = history.filter(h => isSameDay(new Date(h.date), date));
      const focusMinutes = dayHistory.filter(h => h.type === 'focus').reduce((acc, h) => acc + h.duration, 0);
      
      return {
        day: format(date, 'EEE'),
        hours: Number((focusMinutes / 60).toFixed(1)),
        goal: Number(dailyGoal.toFixed(1)),
        sessions: dayHistory.filter(h => h.type === 'focus').length
      };
    });

    setData(chartData);
    setLoading(false);
  }, [history, dailyGoal]);

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
      <div
        className="flex-1 w-full min-h-0 relative"
        role="img"
        aria-label={`Study progress versus goal over 7 days. ${data
          .map((d) => `${d.day}: ${d.hours} hours studied, goal ${d.goal} hours`)
          .join('; ')}.`}
      >
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
