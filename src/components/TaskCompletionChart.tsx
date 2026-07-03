import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useState, useEffect } from 'react';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';
import localforage from 'localforage';
import { auth, db } from '../lib/firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';

export default function TaskCompletionChart() {
  const [data, setData] = useState<{day: string, tasks: number}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      let tasksData: any[] = [];
      
      try {
        if (auth.currentUser) {
          const q = query(collection(db, "users", auth.currentUser.uid, "tasks"));
          const querySnapshot = await getDocs(q);
          tasksData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        
        const storedTasksStr = await localforage.getItem<string>("memora-tasks");
        if (storedTasksStr) {
          const localTasks = JSON.parse(storedTasksStr);
          tasksData = [...tasksData, ...localTasks];
        }

        // Generate data for the last 7 days
        const chartData = Array.from({ length: 7 }).map((_, i) => {
          const date = subDays(new Date(), 6 - i);
          const dayTasks = tasksData.filter(t => t.completed && t.completedAt && isSameDay(new Date(t.completedAt), date));
          
          return {
            day: format(date, 'EEE'),
            tasks: dayTasks.length
          };
        });

        setData(chartData);
      } catch (err) {
        console.error("Failed to fetch tasks for chart", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/60 dark:border-slate-800/60 h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white tracking-tight">Weekly Task Activity</h3>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Tasks completed over the last 7 days.</p>
      </div>
      <div className="flex-1 w-full min-h-0 relative">
        {loading ? (
          <div className="w-full h-full animate-pulse flex items-end justify-between gap-2 px-2">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-md" style={{ height: `${Math.random() * 80 + 20}%` }}></div>
            ))}
          </div>
        ) : (
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
              <Bar dataKey="tasks" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={40} className="dark:fill-indigo-500 fill-indigo-600" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
