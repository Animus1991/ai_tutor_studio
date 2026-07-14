import { describe, it, expect } from 'vitest';
import { buildLibraryExportStats, formatExportStatsCsvRows } from '../libraryExportStats';

describe('libraryExportStats', () => {
  const store = {
    streak: 5,
    streakFreezes: 2,
    pomodoroSessions: 12,
    xp: 340,
    dailyGoal: 120,
    studySessionsHistory: [
      { date: new Date().toISOString(), duration: 45, type: 'focus' },
      { date: new Date().toISOString(), duration: 30, type: 'focus' },
    ],
  };

  it('builds stats from store and tasks', () => {
    const stats = buildLibraryExportStats(store, [
      { completed: true, createdAt: new Date().toISOString() },
      { completed: false, createdAt: new Date().toISOString() },
    ]);

    expect(stats.currentStreak).toBe(5);
    expect(stats.totalPomodoroSessions).toBe(12);
    expect(stats.tasksCompletedThisWeek).toBe(1);
    expect(stats.averageDailyStudyTime).toBeGreaterThan(0);
  });

  it('formats CSV rows for export', () => {
    const stats = buildLibraryExportStats(store, []);
    const rows = formatExportStatsCsvRows(stats);
    expect(rows.some((r) => r.includes('Total Pomodoro Sessions",12'))).toBe(true);
    expect(rows.some((r) => r.includes('Current Streak (Days)",5'))).toBe(true);
  });
});
