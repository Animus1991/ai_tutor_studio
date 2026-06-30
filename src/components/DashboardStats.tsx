import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { format, subDays } from "date-fns";
import { TrendingUp, Clock, CheckCircle2 } from "lucide-react";

const mockAnalyticsData = Array.from({ length: 7 }).map((_, i) => ({
  date: format(subDays(new Date(), 6 - i), 'EEE'),
  focusTime: Math.floor(Math.random() * 120) + 30, // mins
  completionRate: Math.floor(Math.random() * 30) + 70, // %
}));

export default function DashboardStats() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-3xl shadow-sm mb-8 transition-colors duration-300">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            7-Day Activity Summary
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Study time and task completion progress.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <Clock className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Avg Time</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">85m / day</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Avg Completion</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">82%</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mockAnalyticsData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorFocusTime" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorCompletionRate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              wrapperClassName="dark:!bg-slate-800 dark:!text-slate-200 !bg-white !text-slate-900"
            />
            <Legend verticalAlign="top" height={36}/>
            <Area yAxisId="left" type="monotone" name="Study Time (mins)" dataKey="focusTime" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorFocusTime)" />
            <Area yAxisId="right" type="monotone" name="Completion Rate (%)" dataKey="completionRate" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCompletionRate)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
