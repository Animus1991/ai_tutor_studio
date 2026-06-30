import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  Legend,
  Tooltip,
} from 'recharts';

const data = [
  { name: 'Physics', completed: 80, fill: '#6366f1' },
  { name: 'Calculus', completed: 65, fill: '#8b5cf6' },
  { name: 'Literature', completed: 45, fill: '#ec4899' },
  { name: 'Economics', completed: 90, fill: '#14b8a6' },
];

export default function TopicCompletionChart() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/60 dark:border-slate-800/60 flex flex-col h-[400px]">
      <div className="mb-4">
        <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
          Topic Completion Rates
        </h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Progress across your active subjects.
        </p>
      </div>
      <div className="flex-1 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="20%"
            outerRadius="100%"
            barSize={15}
            data={data}
            startAngle={180}
            endAngle={-180}
          >
            <RadialBar
              background={{ fill: 'rgba(0,0,0,0.05)' }}
              dataKey="completed"
              cornerRadius={10}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              formatter={(value: any) => [`${value}%`, 'Completed']}
              wrapperClassName="dark:!bg-slate-800 dark:!text-slate-200 !bg-white !text-slate-900"
            />
            <Legend
              iconSize={10}
              layout="horizontal"
              verticalAlign="bottom"
              wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
