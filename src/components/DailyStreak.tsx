import { Flame } from 'lucide-react';

const streakDays = [
  { day: 'Mon', active: true },
  { day: 'Tue', active: true },
  { day: 'Wed', active: true },
  { day: 'Thu', active: false },
  { day: 'Fri', active: true },
  { day: 'Sat', active: true },
  { day: 'Sun', active: false },
];

export default function DailyStreak() {
  return (
    <div className="bg-gradient-to-br from-orange-500 to-rose-500 rounded-2xl p-5 sm:p-6 shadow-sm text-white h-full flex flex-col justify-between relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
        <Flame className="w-24 h-24 rotate-12 transform scale-150" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <Flame className="w-4 h-4 text-orange-100" />
          </div>
          <h3 className="text-lg font-display font-bold tracking-tight">Daily Streak</h3>
        </div>
        <div className="text-3xl font-display font-bold tracking-tight mt-4">
          5 <span className="text-xl font-medium opacity-80">Days</span>
        </div>
        <p className="text-orange-100 mt-1 text-xs">You are on fire! Keep it up to build strong retention.</p>
      </div>

      <div className="relative z-10 flex items-center justify-between mt-6 gap-1">
        {streakDays.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${d.active ? 'bg-white text-orange-600 shadow-md scale-110' : 'bg-white/20 text-white/60'}`}>
              {d.active ? <Flame className="w-3 h-3" /> : null}
            </div>
            <span className="text-[10px] font-medium text-orange-100">{d.day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
