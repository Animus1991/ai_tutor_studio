/**
 * Offline mutation queue with conflict detection (no silent drop).
 */
import localforage from 'localforage';
import { writeLocalTasks, type LocalTask } from './localTasks';

export const OFFLINE_QUEUE_KEY = 'memora-offline-mutation-queue';
export const OFFLINE_CONFLICTS_KEY = 'memora-offline-conflicts';
export const OFFLINE_QUEUE_UPDATED_EVENT = 'memora:offline-queue-updated';
export const OFFLINE_CONFLICTS_UPDATED_EVENT = 'memora:offline-conflicts-updated';

export type OfflineMutationOp = 'upsert_task' | 'delete_task' | 'upsert_library';

export interface OfflineMutation {
  id: string;
  op: OfflineMutationOp;
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;
  /** Optimistic concurrency token from client before offline edit */
  baseVersion?: number;
}

export type SyncConflict = {
  id: string;
  op: OfflineMutationOp;
  local: Record<string, unknown>;
  remote: Record<string, unknown>;
  createdAt: number;
  reason: string;
};

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

export async function readConflicts(): Promise<SyncConflict[]> {
  const stored = await localforage.getItem<SyncConflict[]>(OFFLINE_CONFLICTS_KEY);
  return Array.isArray(stored) ? stored : [];
}

async function writeConflicts(conflicts: SyncConflict[]): Promise<void> {
  await localforage.setItem(OFFLINE_CONFLICTS_KEY, conflicts.slice(0, 50));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OFFLINE_CONFLICTS_UPDATED_EVENT));
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

export async function getConflictCount(): Promise<number> {
  return (await readConflicts()).length;
}

async function readLocalTasksFromQueue(): Promise<LocalTask[]> {
  const { readLocalTasks } = await import('./localTasks');
  return readLocalTasks();
}

function taskVersion(task: LocalTask & { version?: number; updatedAt?: string }): number {
  if (typeof task.version === 'number') return task.version;
  if (task.updatedAt) {
    const t = new Date(task.updatedAt).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

async function applyTaskMutation(mutation: OfflineMutation): Promise<'applied' | 'conflict' | 'fail'> {
  const tasks = await readLocalTasksFromQueue();
  if (mutation.op === 'delete_task') {
    const taskId = String(mutation.payload.taskId ?? '');
    await writeLocalTasks(tasks.filter((task) => task.id !== taskId));
    return 'applied';
  }

  const task = mutation.payload.task as (LocalTask & { version?: number; updatedAt?: string }) | undefined;
  if (!task?.id) return 'fail';
  const index = tasks.findIndex((entry) => entry.id === task.id);
  if (index >= 0) {
    const existing = tasks[index] as LocalTask & { version?: number; updatedAt?: string };
    const remoteVer = taskVersion(existing);
    const baseVer = mutation.baseVersion ?? 0;
    // Conflict when remote moved ahead of the base the offline edit started from
    if (baseVer > 0 && remoteVer > baseVer && JSON.stringify(existing) !== JSON.stringify({ ...existing, ...task })) {
      const conflicts = await readConflicts();
      conflicts.unshift({
        id: `conflict-${task.id}-${Date.now()}`,
        op: mutation.op,
        local: { task },
        remote: { task: existing },
        createdAt: Date.now(),
        reason: 'Remote task changed while offline (version mismatch)',
      });
      await writeConflicts(conflicts);
      return 'conflict';
    }
    tasks[index] = {
      ...existing,
      ...task,
      version: Math.max(remoteVer, taskVersion(task)) + 1,
    } as LocalTask;
  } else {
    tasks.push({ ...task, version: (task.version ?? 0) + 1 } as LocalTask);
  }
  await writeLocalTasks(tasks);
  return 'applied';
}

/** Resolve conflict by keeping local or remote side. */
export async function resolveConflict(
  conflictId: string,
  choice: 'local' | 'remote' | 'dismiss',
): Promise<void> {
  const conflicts = await readConflicts();
  const idx = conflicts.findIndex((c) => c.id === conflictId);
  if (idx < 0) return;
  const [conflict] = conflicts.splice(idx, 1);
  await writeConflicts(conflicts);

  if (choice === 'dismiss' || !conflict) return;
  if (conflict.op === 'upsert_task') {
    const task =
      choice === 'local'
        ? (conflict.local.task as LocalTask)
        : (conflict.remote.task as LocalTask);
    if (task?.id) {
      await enqueueOfflineMutation({
        id: `task:${task.id}`,
        op: 'upsert_task',
        payload: { task: { ...task, version: Date.now() } },
        baseVersion: 0,
      });
      await flushOfflineMutationQueue();
    }
  }
}

export async function flushOfflineMutationQueue(): Promise<{
  applied: number;
  remaining: number;
  conflicts: number;
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const size = await getOfflineQueueSize();
    return { applied: 0, remaining: size, conflicts: await getConflictCount() };
  }

  // Authorize: server-scoped ops require a signed-in principal when auth is enforced.
  try {
    const { useAuthStore } = await import('../store/useAuthStore');
    const { auth } = await import('./firebase');
    const requireAuth =
      String(import.meta.env.VITE_REQUIRE_API_AUTH ?? '').toLowerCase() === 'true';
    if (requireAuth && !auth.currentUser && !useAuthStore.getState().isDemoMode) {
      const size = await getOfflineQueueSize();
      return { applied: 0, remaining: size, conflicts: await getConflictCount() };
    }
  } catch {
    /* continue best-effort */
  }

  const queue = await readQueue();
  const remaining: OfflineMutation[] = [];
  let applied = 0;
  let conflicts = 0;

  for (const mutation of queue) {
    try {
      if (mutation.op === 'upsert_task' || mutation.op === 'delete_task') {
        const result = await applyTaskMutation(mutation);
        if (result === 'applied') {
          applied += 1;
          const { postLearningEvent } = await import('./spineEvents');
          postLearningEvent({
            kind: mutation.op === 'delete_task' ? 'task_complete' : 'task_review',
            surface: 'offline',
            success: true,
            principles: ['retrieval', 'spacing'],
            meta: { mutationId: mutation.id },
          });
        } else if (result === 'conflict') conflicts += 1;
        else remaining.push({ ...mutation, retries: mutation.retries + 1 });
      } else {
        // library upsert — keep for future server merge; don't silent-drop
        remaining.push({ ...mutation, retries: mutation.retries + 1 });
      }
    } catch {
      remaining.push({ ...mutation, retries: mutation.retries + 1 });
    }
  }

  await writeQueue(remaining.slice(0, 200));
  const { postAuditBeacon } = await import('./spineEvents');
  postAuditBeacon('OFFLINE_FLUSH', { applied, remaining: remaining.length, conflicts });
  return { applied, remaining: remaining.length, conflicts: conflicts + (await getConflictCount()) };
}

/** Register Background Sync tag when supported (SW). */
export async function registerBackgroundSync(tag = 'memora-offline-flush'): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    // SyncManager is not in all TS libs
    const syncManager = (reg as ServiceWorkerRegistration & { sync?: { register: (t: string) => Promise<void> } })
      .sync;
    if (!syncManager) return false;
    await syncManager.register(tag);
    return true;
  } catch {
    return false;
  }
}
