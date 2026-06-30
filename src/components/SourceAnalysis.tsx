import React from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit, ShieldAlert } from 'lucide-react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';

interface SourceMetrics {
  quality: number;
  density: number;
  readability: number;
  needsMoreMaterial: boolean;
}

const Gauge = ({ value, label, color }: { value: number; label: string; color: string }) => {
  const data = [{ name: label, value }];

  return (
    <div className="flex flex-col items-center justify-center relative h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart 
          cx="50%" 
          cy="100%" 
          innerRadius="70%" 
          outerRadius="100%" 
          barSize={15} 
          data={data}
          startAngle={180}
          endAngle={0}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            minPointSize={15}
            background={{ fill: 'var(--color-bg)' }}
            dataKey="value"
            cornerRadius={10}
            fill={color}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute flex flex-col items-center bottom-0 translate-y-1">
        <span className="text-xl font-display font-bold text-slate-900 dark:text-white leading-none mb-1">
          {value}%
        </span>
        <span className="text-[10px] uppercase font-bold text-slate-500">
          {label}
        </span>
      </div>
    </div>
  );
};

export const SourceAnalysis = ({ metrics }: { metrics: SourceMetrics }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, height: 0, y: -20 }}
      animate={{ opacity: 1, height: 'auto', y: 0 }}
      className="mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm"
      style={{ '--color-bg': 'rgba(148, 163, 184, 0.1)' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 mb-2">
        <BrainCircuit className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <h3 className="font-bold text-slate-900 dark:text-white">Document Analysis</h3>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <Gauge value={metrics.quality} label="Quality" color="#10b981" />
        <Gauge value={metrics.density} label="Density" color="#6366f1" />
        <Gauge value={metrics.readability} label="Readability" color="#0ea5e9" />
      </div>

      {metrics.needsMoreMaterial && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-6 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800 p-3.5 rounded-xl text-sm font-medium flex items-center gap-3"
        >
          <ShieldAlert className="w-5 h-5 shrink-0" />
          Το κείμενο ίσως δεν επαρκεί για παραγωγή ολοκληρωμένων flashcards. Θέλετε να προσθέσετε κι άλλο υλικό;
        </motion.div>
      )}
    </motion.div>
  );
};
