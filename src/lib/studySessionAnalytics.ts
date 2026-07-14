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

export type OptimalStudyWindow = {
  label: string;
  hour: number;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
};

function formatHour12(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:00 ${ampm}`;
}

/** Predict next optimal focus window from session history and optional deadline pressure. */
export function predictOptimalStudyTime(
  history: StudySessionRecord[],
  options: { upcomingUrgentTasks?: number; now?: Date } = {},
): OptimalStudyWindow {
  const now = options.now ?? new Date();
  const hourWeights = new Array(24).fill(0) as number[];

  for (const session of history) {
    if (session.type !== 'focus') continue;
    try {
      hourWeights[parseISO(session.date).getHours()] += session.duration;
    } catch {
      /* skip malformed dates */
    }
  }

  const totalWeight = hourWeights.reduce((a, b) => a + b, 0);
  let peakHour = -1;
  let maxWeight = 0;
  for (let h = 0; h < 24; h++) {
    if (hourWeights[h] > maxWeight) {
      maxWeight = hourWeights[h];
      peakHour = h;
    }
  }

  const fallbackHours = [9, 14, 19];
  let targetHour = peakHour >= 0 ? peakHour : fallbackHours[0];
  let confidence: OptimalStudyWindow['confidence'] = 'low';
  let reason = 'Default morning focus window (no session history yet).';

  if (totalWeight > 0 && peakHour >= 0) {
    confidence = totalWeight >= 120 ? 'high' : 'medium';
    reason = `Peak focus historically around ${formatHour12(peakHour)} (${Math.round(maxWeight)} min logged).`;
    targetHour = peakHour;
  }

  if (targetHour <= now.getHours()) {
    const nextFallback = fallbackHours.find((h) => h > now.getHours());
    targetHour = nextFallback ?? fallbackHours[0];
    if (totalWeight > 0) {
      reason += ' Showing next available slot today.';
    }
  }

  if ((options.upcomingUrgentTasks ?? 0) > 0 && targetHour > now.getHours() + 2) {
    targetHour = Math.min(23, now.getHours() + 1);
    reason += ' Adjusted earlier due to urgent tasks.';
    confidence = confidence === 'high' ? 'high' : 'medium';
  }

  return {
    label: formatHour12(targetHour),
    hour: targetHour,
    confidence,
    reason,
  };
}
