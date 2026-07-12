import { format, isToday, isTomorrow } from 'date-fns';

export type RoadmapStatus = 'completed' | 'active' | 'pending';

export interface RoadmapMilestone {
  id: string;
  title: string;
  status: RoadmapStatus;
  time: string;
}

export interface RoadmapTaskInput {
  id: string;
  title: string;
  completed: boolean;
  createdAt?: string;
  nextReviewDate?: string;
  time?: string;
}

function formatMilestoneTime(iso?: string, fallback?: string): string {
  if (!iso) return fallback ?? 'Soon';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback ?? 'Soon';
  if (isToday(d)) return `Today, ${format(d, 'h:mm a')}`;
  if (isTomorrow(d)) return `Tomorrow, ${format(d, 'h:mm a')}`;
  return format(d, 'EEE, h:mm a');
}

/** Build timeline milestones from tasks: completed first, then next due as active. */
export function buildStudyRoadmapMilestones(
  tasks: RoadmapTaskInput[],
  limit = 6,
): RoadmapMilestone[] {
  const sorted = [...tasks]
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? -1 : 1;
      const aDate = new Date(a.nextReviewDate ?? a.createdAt ?? 0).getTime();
      const bDate = new Date(b.nextReviewDate ?? b.createdAt ?? 0).getTime();
      return aDate - bDate;
    })
    .slice(0, limit);

  let activeAssigned = false;

  return sorted.map((task) => {
    let status: RoadmapStatus = 'pending';
    if (task.completed) {
      status = 'completed';
    } else if (!activeAssigned) {
      status = 'active';
      activeAssigned = true;
    }

    return {
      id: task.id,
      title: task.title,
      status,
      time: formatMilestoneTime(task.nextReviewDate ?? task.createdAt, task.time),
    };
  });
}

export function roadmapProgressPercent(milestones: RoadmapMilestone[]): number {
  if (milestones.length === 0) return 0;
  const completed = milestones.filter((m) => m.status === 'completed').length;
  return Math.round((completed / milestones.length) * 100);
}
