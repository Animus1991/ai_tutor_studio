import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const data = [
  { day: 'Mon', tasks: 4 },
  { day: 'Tue', tasks: 7 },
  { day: 'Wed', tasks: 3 },
  { day: 'Thu', tasks: 8 },
  { day: 'Fri', tasks: 5 },
  { day: 'Sat', tasks: 2 },
  { day: 'Sun', tasks: 6 },
];

export default function TaskCompletionChart() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/60 dark:border-slate-800/60">
      <div className="mb-4">
        <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white tracking-tight">Weekly Task Activity</h3>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Tasks completed over the last 7 days.</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              cursor={{ fill: 'currentColor', opacity: 0.1 }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
              wrapperClassName="dark:!bg-slate-800 dark:!text-slate-200 !bg-white !text-slate-900 !rounded-xl"
            />
            <Bar dataKey="tasks" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={40} className="dark:fill-indigo-500 fill-indigo-600" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
