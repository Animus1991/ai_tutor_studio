import { useState, useEffect } from 'react';
import { Battery, BatteryLow, BatteryCharging, BatteryMedium, BatteryWarning } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/i18n';

export default function BatteryIndicator() {
  const { t } = useLanguage();
  const [level, setLevel] = useState<number | null>(null);
  const [charging, setCharging] = useState<boolean>(false);
  const [supported, setSupported] = useState<boolean>(true);

  useEffect(() => {
    let battery: any = null;

    const updateBattery = () => {
      if (battery) {
        setLevel(battery.level);
        setCharging(battery.charging);
      }
    };

    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((b: any) => {
        battery = b;
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
      });
    } else {
      setSupported(false);
    }

    return () => {
      if (battery) {
        battery.removeEventListener('levelchange', updateBattery);
        battery.removeEventListener('chargingchange', updateBattery);
      }
    };
  }, []);

  if (!supported || level === null) return null;

  const isLow = level <= 0.2 && !charging;
  const percentage = Math.round(level * 100);

  let Icon = Battery;
  if (charging) Icon = BatteryCharging;
  else if (isLow) Icon = BatteryWarning;
  else if (level <= 0.5) Icon = BatteryMedium;
  else if (level <= 0.2) Icon = BatteryLow;

  return (
    <div 
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors",
        isLow ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
      )}
      title={t(`Battery: ${percentage}%${charging ? ' (Charging)' : ''}`, `Μπαταρία: ${percentage}%${charging ? ' (Φόρτιση)' : ''}`)}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{percentage}%</span>
    </div>
  );
}
