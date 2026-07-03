import React from 'react';

interface AwarenessUser {
  name: string;
  color: string;
  avatar: string;
}

interface PresenceIndicatorProps {
  users: AwarenessUser[];
}

export default function PresenceIndicator({ users }: PresenceIndicatorProps) {
  return (
    <div className="flex items-center mr-2">
      {users.map((awUser, i) => (
        <div 
          key={i} 
          className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 -ml-2 first:ml-0 relative group shadow-sm"
          style={{ zIndex: 10 - i }}
        >
          <img src={awUser.avatar} alt={awUser.name} className="w-full h-full rounded-full object-cover" />
          <div className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900" style={{ backgroundColor: awUser.color }} />
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            {awUser.name}
          </div>
        </div>
      ))}
    </div>
  );
}
