import { format, subDays, isSameDay, parseISO } from 'date-fns';

export type StudyActivityPoint = {
  day: string;
  studyTime: number;
  goalTime: number;
};

export type StudySessionRecord = {
  date: string;
  duration: number;
  type: string;
};

/** Weekly study minutes vs daily goal (minutes). */
export function buildStudyActivityData(
  history: StudySessionRecord[],
  dailyGoalMinutes: number,
): StudyActivityPoint[] {
  return Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const studyTime = history
      .filter(
        (h) =>
          h.type === 'focus' &&
          isSameDay(parseISO(h.date), date),
      )
      .reduce((acc, h) => acc + h.duration, 0);

    return {
      day: format(date, 'EEE'),
      studyTime,
      goalTime: dailyGoalMinutes,
    };
  });
}

export function averageFocusMinutes(points: StudyActivityPoint[]): number {
  if (points.length === 0) return 0;
  return Math.round(points.reduce((sum, p) => sum + p.studyTime, 0) / points.length);
}
