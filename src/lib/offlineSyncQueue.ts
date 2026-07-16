import localforage from 'localforage';
import { writeLocalTasks, type LocalTask } from './localTasks';

export const OFFLINE_QUEUE_KEY = 'memora-offline-mutation-queue';
export const OFFLINE_QUEUE_UPDATED_EVENT = 'memora:offline-queue-updated';

export type OfflineMutationOp = 'upsert_task' | 'delete_task';

export interface OfflineMutation {
  id: string;
  op: OfflineMutationOp;
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;
}

async function readQueue(): Promise<OfflineMutation[]> {
  const stored = await localforage.getItem<OfflineMutation[]>(OFFLINE_QUEUE_KEY);
  return Array.isArray(stored) ? stored : [];
}

async function writeQueue(queue: OfflineMutation[]): Promise<void> {
  await localforage.setItem(OFFLINE_QUEUE_KEY, queue);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_UPDATED_EVENT));
  }
}

export async function enqueueOfflineMutation(
  mutation: Omit<OfflineMutation, 'createdAt' | 'retries'> & {
    createdAt?: number;
    retries?: number;
  },
): Promise<void> {
  const queue = await readQueue();
  const next = queue.filter((entry) => entry.id !== mutation.id);
  next.push({
    ...mutation,
    createdAt: mutation.createdAt ?? Date.now(),
    retries: mutation.retries ?? 0,
  });
  await writeQueue(next);
}

export async function getOfflineQueueSize(): Promise<number> {
  return (await readQueue()).length;
}

async function applyTaskMutation(mutation: OfflineMutation): Promise<boolean> {
  const tasks = await readLocalTasksFromQueue();
  if (mutation.op === 'delete_task') {
    const taskId = String(mutation.payload.taskId ?? '');
    await writeLocalTasks(tasks.filter((task) => task.id !== taskId));
    return true;
  }

  const task = mutation.payload.task as LocalTask | undefined;
  if (!task?.id) return false;
  const index = tasks.findIndex((entry) => entry.id === task.id);
  if (index >= 0) tasks[index] = { ...tasks[index], ...task };
  else tasks.push(task);
  await writeLocalTasks(tasks);
  return true;
}

async function readLocalTasksFromQueue(): Promise<LocalTask[]> {
  const { readLocalTasks } = await import('./localTasks');
  return readLocalTasks();
}

export async function flushOfflineMutationQueue(): Promise<{
  applied: number;
  remaining: number;
}> {
  if (!navigator.onLine) {
    const size = await getOfflineQueueSize();
    return { applied: 0, remaining: size };
  }

  const queue = await readQueue();
  const remaining: OfflineMutation[] = [];
  let applied = 0;

  for (const mutation of queue) {
    try {
      const ok =
        mutation.op === 'upsert_task' || mutation.op === 'delete_task'
          ? await applyTaskMutation(mutation)
          : false;
      if (ok) applied += 1;
      else remaining.push({ ...mutation, retries: mutation.retries + 1 });
    } catch {
      remaining.push({ ...mutation, retries: mutation.retries + 1 });
    }
  }

  await writeQueue(remaining.slice(0, 200));
  return { applied, remaining: remaining.length };
}
