import localforage from 'localforage';

export const DEMO_MODE_KEY = 'memora-demo-mode';
export const DEMO_TASKS_KEY = 'memora-tasks';
export const DEMO_ACTIVITIES_KEY = 'memora-demo-activities';

function hasWorkingLocalStorage(): boolean {
  return (
    typeof localStorage !== 'undefined' &&
    typeof localStorage.getItem === 'function'
  );
}

export interface DemoTask {
  id: string;
  title: string;
  notes?: string;
  course: string;
  type: string;
  tags?: string[];
  time: string;
  urgent: boolean;
  icon: string;
  color: string;
  bg: string;
  completed: boolean;
  userId: string;
  createdAt: string;
  order: number;
  repetition?: number;
  interval?: number;
  easeFactor?: number;
  nextReviewDate?: string;
  fsrsCard?: Record<string, unknown>;
}

export interface DemoActivity {
  id: string;
  title: string;
  type: 'study' | 'upload' | 'collab' | 'task' | 'other';
  timestamp: string;
}

export const DEMO_USER = { uid: 'demo-user', email: 'demo@memora.local' };

export function buildDemoTasks(): DemoTask[] {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  return [
    {
      id: 'demo-task-1',
      title: 'Review Cournot vs Bertrand models',
      notes: 'Compare quantity vs price competition. Focus on equilibrium differences.',
      course: 'Demo: Microeconomics',
      type: 'Review',
      tags: ['Microeconomics', 'Review'],
      time: '45 min',
      urgent: true,
      icon: 'AlertTriangle',
      color: 'text-rose-500',
      bg: 'bg-rose-50',
      completed: false,
      userId: DEMO_USER.uid,
      createdAt: now.toISOString(),
      order: 0,
      nextReviewDate: now.toISOString(),
    },
    {
      id: 'demo-task-2',
      title: 'Read Chapter 4: Market Equilibrium',
      course: 'Demo: Microeconomics',
      type: 'Reading',
      tags: ['Reading'],
      time: '30 min',
      urgent: false,
      icon: 'BookOpen',
      color: 'text-indigo-500',
      bg: 'bg-indigo-50',
      completed: false,
      userId: DEMO_USER.uid,
      createdAt: now.toISOString(),
      order: 1,
      nextReviewDate: tomorrow.toISOString(),
    },
    {
      id: 'demo-task-3',
      title: 'Quiz Prep: Price Elasticity',
      course: 'Demo: Microeconomics',
      type: 'Quiz Prep',
      tags: ['Quiz Prep'],
      time: '25 min',
      urgent: false,
      icon: 'PenTool',
      color: 'text-violet-500',
      bg: 'bg-violet-50',
      completed: false,
      userId: DEMO_USER.uid,
      createdAt: now.toISOString(),
      order: 2,
      nextReviewDate: tomorrow.toISOString(),
    },
    {
      id: 'demo-task-4',
      title: 'Complete practice problems on consumer surplus',
      course: 'Demo: Microeconomics',
      type: 'Review',
      tags: ['Review'],
      time: '20 min',
      urgent: false,
      icon: 'Target',
      color: 'text-emerald-500',
      bg: 'bg-emerald-50',
      completed: true,
      userId: DEMO_USER.uid,
      createdAt: yesterday.toISOString(),
      order: 3,
      nextReviewDate: yesterday.toISOString(),
    },
    {
      id: 'demo-task-5',
      title: 'Deep dive: Marginal cost MC = 2q + 5',
      course: 'Demo: Microeconomics',
      type: 'Reading',
      tags: ['Reading', 'Formulas'],
      time: '35 min',
      urgent: false,
      icon: 'BookOpen',
      color: 'text-sky-500',
      bg: 'bg-sky-50',
      completed: false,
      userId: DEMO_USER.uid,
      createdAt: now.toISOString(),
      order: 4,
      nextReviewDate: tomorrow.toISOString(),
    },
  ];
}

export function buildDemoActivities(): DemoActivity[] {
  const now = new Date();
  return [
    {
      id: 'demo-act-1',
      title: 'Completed "Review Macroeconomics"',
      type: 'task',
      timestamp: new Date(now.getTime() - 12 * 60_000).toISOString(),
    },
    {
      id: 'demo-act-2',
      title: 'Asked AI Tutor about "IS-LM Model"',
      type: 'study',
      timestamp: new Date(now.getTime() - 45 * 60_000).toISOString(),
    },
    {
      id: 'demo-act-3',
      title: 'Uploaded "Econ Chapter 4.pdf"',
      type: 'upload',
      timestamp: new Date(now.getTime() - 120 * 60_000).toISOString(),
    },
    {
      id: 'demo-act-4',
      title: 'Started Study Workspace: Microeconomics',
      type: 'study',
      timestamp: new Date(now.getTime() - 180 * 60_000).toISOString(),
    },
    {
      id: 'demo-act-5',
      title: 'Reviewed flashcards: Elasticity',
      type: 'task',
      timestamp: new Date(now.getTime() - 24 * 60 * 60_000).toISOString(),
    },
    {
      id: 'demo-act-6',
      title: 'Focus session: 25 minutes',
      type: 'study',
      timestamp: new Date(now.getTime() - 26 * 60 * 60_000).toISOString(),
    },
    {
      id: 'demo-act-7',
      title: 'Joined Collab Space study group',
      type: 'collab',
      timestamp: new Date(now.getTime() - 48 * 60 * 60_000).toISOString(),
    },
  ];
}

export async function loadDemoTasks(): Promise<DemoTask[]> {
  const raw = await localforage.getItem<string>(DEMO_TASKS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DemoTask[];
  } catch {
    return [];
  }
}

export async function saveDemoTasks(tasks: DemoTask[]): Promise<void> {
  await localforage.setItem(DEMO_TASKS_KEY, JSON.stringify(tasks));
}

export async function seedDemoTasks(): Promise<DemoTask[]> {
  const existing = await loadDemoTasks();
  if (existing.length > 0) return existing;
  const tasks = buildDemoTasks();
  await saveDemoTasks(tasks);
  return tasks;
}

export async function loadDemoActivities(): Promise<DemoActivity[]> {
  const raw = await localforage.getItem<string>(DEMO_ACTIVITIES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DemoActivity[];
  } catch {
    return [];
  }
}

export async function saveDemoActivities(activities: DemoActivity[]): Promise<void> {
  await localforage.setItem(DEMO_ACTIVITIES_KEY, JSON.stringify(activities));
}

export async function seedDemoActivities(): Promise<DemoActivity[]> {
  const existing = await loadDemoActivities();
  if (existing.length > 0) return existing;
  const activities = buildDemoActivities();
  await saveDemoActivities(activities);
  return activities;
}

export async function appendDemoActivity(title: string, type: DemoActivity['type']): Promise<void> {
  const activities = await loadDemoActivities();
  activities.unshift({
    id: `demo-act-${Date.now()}`,
    title,
    type,
    timestamp: new Date().toISOString(),
  });
  await saveDemoActivities(activities.slice(0, 50));
}

export async function clearDemoData(): Promise<void> {
  await localforage.removeItem(DEMO_TASKS_KEY);
  await localforage.removeItem(DEMO_ACTIVITIES_KEY);
  if (hasWorkingLocalStorage()) {
    localStorage.removeItem(DEMO_MODE_KEY);
  }
}

export function isDemoModeActive(): boolean {
  if (!hasWorkingLocalStorage()) return false;
  return localStorage.getItem(DEMO_MODE_KEY) === '1';
}

export function setDemoModeFlag(active: boolean): void {
  if (!hasWorkingLocalStorage()) return;
  if (active) {
    localStorage.setItem(DEMO_MODE_KEY, '1');
  } else {
    localStorage.removeItem(DEMO_MODE_KEY);
  }
}
