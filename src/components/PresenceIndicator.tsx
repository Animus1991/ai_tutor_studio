import React from 'react';
import { useLanguage } from '../lib/i18n';

export type ActivityStatus = 'online' | 'typing' | 'reading' | 'idle';

interface AwarenessUser {
  name: string;
  color: string;
  avatar: string;
  activity?: ActivityStatus;
}

interface PresenceIndicatorProps {
  users: AwarenessUser[];
}

const ACTIVITY_DOT: Record<ActivityStatus, string> = {
  online: 'bg-emerald-500',
  typing: 'bg-amber-500 animate-pulse',
  reading: 'bg-sky-500',
  idle: 'bg-slate-400',
};

export default function PresenceIndicator({ users }: PresenceIndicatorProps) {
  const { t } = useLanguage();

  const activityLabel = (status: ActivityStatus) => {
    switch (status) {
      case 'typing': return t('typing…', 'γράφει…');
      case 'reading': return t('reading', 'διαβάζει');
      case 'idle': return t('idle', 'αδρανής');
      default: return t('online', 'online');
    }
  };

  return (
    <div className="flex items-center mr-2">
      {users.map((awUser, i) => {
        const activity = awUser.activity ?? 'online';
        return (
          <div 
            key={i} 
            className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 -ml-2 first:ml-0 relative group shadow-sm"
            style={{ zIndex: 10 - i }}
          >
            <img src={awUser.avatar} alt={awUser.name} className="w-full h-full rounded-full object-cover" />
            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${ACTIVITY_DOT[activity]}`} />
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 dark:bg-slate-700 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg flex flex-col items-center gap-0.5">
              <span className="font-semibold">{awUser.name}</span>
              <span className="text-slate-300 text-xs">{activityLabel(activity)}</span>
            </div>
          </div>
        );
      })}
      {users.length > 0 && (
        <span className="ml-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {users.length} {t('online', 'online')}
        </span>
      )}
    </div>
  );
}
