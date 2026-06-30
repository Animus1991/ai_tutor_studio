import { RadialBarChart, RadialBar, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { useMasteryStore } from '../store/useMasteryStore';

export default function MasteryOverview() {
  const { flashcardReviews, feynmanScore, getOverallMastery } = useMasteryStore();
  
  const data = [
    { name: 'Flashcard Reviews', value: Math.min(flashcardReviews * 5, 100), fill: '#f43f5e' },
    { name: 'Feynman Progress', value: Math.min(feynmanScore * 2, 100), fill: '#10b981' },
    { name: 'Overall Mastery', value: getOverallMastery(), fill: '#6366f1' },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-200/60 dark:border-slate-800/60 h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white tracking-tight">Mastery Overview</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Global progress based on active study techniques.</p>
      </div>
      <div className="flex-1 w-full min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart 
            cx="50%" 
            cy="50%" 
            innerRadius="30%" 
            outerRadius="100%" 
            barSize={15} 
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar
              background={{ fill: 'rgba(0,0,0,0.05)' }}
              dataKey="value"
              cornerRadius={10}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              wrapperClassName="dark:!bg-slate-800 dark:!text-slate-200 !bg-white !text-slate-900 !rounded-xl"
            />
            <Legend iconSize={10} layout="vertical" verticalAlign="middle" wrapperStyle={{ right: 0, top: 0, fontSize: '12px' }} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
