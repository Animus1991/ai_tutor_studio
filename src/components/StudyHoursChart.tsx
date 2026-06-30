import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const data = [
  { topic: 'Math', hours: 12 },
  { topic: 'Physics', hours: 8 },
  { topic: 'History', hours: 15 },
  { topic: 'Literature', hours: 6 },
  { topic: 'CS', hours: 20 },
];

export default function StudyHoursChart() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 shadow-sm w-full h-[400px] lg:h-[600px] flex flex-col">
      <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-1">Study Hours by Topic</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Total time invested across subjects</p>
      <div className="flex-1 w-full min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
            <XAxis 
              dataKey="topic" 
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
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              wrapperClassName="dark:!bg-slate-800 dark:!text-slate-200 !bg-white !text-slate-900 !rounded-xl"
            />
            <Bar dataKey="hours" fill="#0ea5e9" radius={[6, 6, 0, 0]} barSize={40} className="dark:fill-sky-500 fill-sky-600" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
