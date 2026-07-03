import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import { useStore } from "../store/useStore";
import { format, subDays, startOfDay, isSameDay } from "date-fns";

export default function StudyTimeChart() {
  const history = useStore(state => state.studySessionsHistory);
  
  // Prepare data for the last 7 days
  const data = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayHistory = history.filter(h => isSameDay(new Date(h.date), date));
    const focusMinutes = dayHistory.filter(h => h.type === 'focus').reduce((acc, h) => acc + h.duration, 0);
    
    return {
      name: format(date, 'EEE'),
      minutes: focusMinutes
    };
  });

  const totalMinutes = data.reduce((acc, curr) => acc + curr.minutes, 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return (
    <div className="h-full flex flex-col justify-between">
      <div className="mb-2">
        <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
          {hours}h {minutes}m
        </p>
        <p className="text-xs font-medium text-sky-600 dark:text-sky-400">Total this week</p>
      </div>
      <div className="h-20 w-full mt-auto">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="minutes" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
