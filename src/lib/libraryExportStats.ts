import { isSameDay, parseISO, subDays } from 'date-fns';
import { averageFocusMinutes, buildStudyActivityData } from './studySessionAnalytics';

export type LibraryExportStats = {
  currentStreak: number;
  streakFreezes: number;
  totalPomodoroSessions: number;
  averageDailyStudyTime: number;
  tasksCompletedThisWeek: number;
  xp: number;
  dailyGoalMinutes: number;
  totalFocusMinutesThisWeek: number;
};

export type StoreSnapshotForExport = {
  streak: number;
  streakFreezes: number;
  pomodoroSessions: number;
  studySessionsHistory: Array<{ date: string; duration: number; type: string }>;
  xp: number;
  dailyGoal: number;
};

type TaskRecord = {
  completed?: boolean;
  createdAt?: string;
  completedAt?: string;
};

function parseTaskDate(task: TaskRecord): Date | null {
  const raw = task.completedAt ?? task.createdAt;
  if (!raw) return null;
  try {
    return typeof raw === 'string'
      ? parseISO(raw)
      : (raw as { toDate?: () => Date }).toDate?.() ?? null;
  } catch {
    return null;
  }
}

function countTasksCompletedThisWeek(tasks: TaskRecord[]): number {
  const weekStart = subDays(new Date(), 6);
  weekStart.setHours(0, 0, 0, 0);

  return tasks.filter((task) => {
    if (!task.completed) return false;
    const date = parseTaskDate(task);
    if (!date) return false;
    return date >= weekStart;
  }).length;
}

/** Build export stats from persisted app store + task list. */
export function buildLibraryExportStats(
  store: StoreSnapshotForExport,
  tasks: TaskRecord[],
): LibraryExportStats {
  const weekActivity = buildStudyActivityData(store.studySessionsHistory, store.dailyGoal);
  const totalFocusMinutesThisWeek = weekActivity.reduce((sum, d) => sum + d.studyTime, 0);

  return {
    currentStreak: store.streak,
    streakFreezes: store.streakFreezes,
    totalPomodoroSessions: store.pomodoroSessions,
    averageDailyStudyTime: averageFocusMinutes(weekActivity),
    tasksCompletedThisWeek: countTasksCompletedThisWeek(tasks),
    xp: store.xp,
    dailyGoalMinutes: store.dailyGoal,
    totalFocusMinutesThisWeek,
  };
}

export function formatExportStatsCsvRows(stats: LibraryExportStats): string[] {
  return [
    `"Current Streak (Days)",${stats.currentStreak}`,
    `"Streak Freezes",${stats.streakFreezes}`,
    `"Total Pomodoro Sessions",${stats.totalPomodoroSessions}`,
    `"Average Daily Study Time (mins)",${stats.averageDailyStudyTime}`,
    `"Focus Minutes This Week",${stats.totalFocusMinutesThisWeek}`,
    `"Daily Goal (mins)",${stats.dailyGoalMinutes}`,
    `"Tasks Completed this Week",${stats.tasksCompletedThisWeek}`,
    `"Total XP",${stats.xp}`,
  ];
}

export function formatExportStatsMarkdown(stats: LibraryExportStats): string[] {
  return [
    `- **Current Streak**: ${stats.currentStreak} days`,
    `- **Streak Freezes**: ${stats.streakFreezes}`,
    `- **Total Pomodoro Sessions**: ${stats.totalPomodoroSessions}`,
    `- **Average Daily Study Time**: ${stats.averageDailyStudyTime} mins`,
    `- **Focus Minutes This Week**: ${stats.totalFocusMinutesThisWeek} mins`,
    `- **Daily Goal**: ${stats.dailyGoalMinutes} mins`,
    `- **Tasks Completed this Week**: ${stats.tasksCompletedThisWeek}`,
    `- **Total XP**: ${stats.xp}`,
  ];
}
