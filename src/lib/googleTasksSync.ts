/**
 * Conflict-free Memora ↔ Google Tasks sync helpers (last-write-wins + merge report).
 */

export type SyncableTask = {
  id: string;
  title: string;
  notes?: string;
  completed?: boolean;
  due?: string | null;
  /** Epoch ms or ISO — higher wins on conflict */
  updatedAt?: string | number | null;
  googleTaskId?: string | null;
};

export type GoogleTaskRow = {
  id: string;
  title?: string;
  notes?: string;
  status?: string;
  due?: string;
  updated?: string;
};

export type TaskMergeConflict = {
  localId: string;
  googleId: string;
  winner: 'local' | 'google';
  reason: string;
};

export type TaskMergeResult = {
  toPush: SyncableTask[];
  toPull: SyncableTask[];
  conflicts: TaskMergeConflict[];
  merged: SyncableTask[];
};

function asTime(value: string | number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value) {
    const t = Date.parse(value);
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Map a Google Tasks API row into Memora shape. */
export function googleTaskToLocal(row: GoogleTaskRow): SyncableTask {
  return {
    id: `g:${row.id}`,
    title: row.title?.trim() || 'Untitled',
    notes: row.notes,
    completed: row.status === 'completed',
    due: row.due ?? null,
    updatedAt: row.updated ?? null,
    googleTaskId: row.id,
  };
}

/**
 * Last-write-wins merge by googleTaskId, else fuzzy title match.
 * User-visible conflicts are listed when both sides changed.
 */
export function mergeTasksLastWriteWins(
  local: SyncableTask[],
  remote: GoogleTaskRow[],
): TaskMergeResult {
  const remoteMapped = remote.map(googleTaskToLocal);
  const remoteById = new Map(remoteMapped.map((t) => [t.googleTaskId!, t]));
  const usedRemote = new Set<string>();
  const toPush: SyncableTask[] = [];
  const toPull: SyncableTask[] = [];
  const conflicts: TaskMergeConflict[] = [];
  const merged: SyncableTask[] = [];

  for (const loc of local) {
    let rem: SyncableTask | undefined;
    if (loc.googleTaskId && remoteById.has(loc.googleTaskId)) {
      rem = remoteById.get(loc.googleTaskId);
    } else {
      rem = remoteMapped.find(
        (r) =>
          !usedRemote.has(r.googleTaskId!) &&
          normalizeTitle(r.title) === normalizeTitle(loc.title),
      );
    }

    if (!rem) {
      toPush.push(loc);
      merged.push(loc);
      continue;
    }

    usedRemote.add(rem.googleTaskId!);
    const localT = asTime(loc.updatedAt);
    const remoteT = asTime(rem.updatedAt);
    if (localT === remoteT) {
      merged.push({ ...loc, googleTaskId: rem.googleTaskId });
      continue;
    }
    if (localT > remoteT) {
      conflicts.push({
        localId: loc.id,
        googleId: rem.googleTaskId!,
        winner: 'local',
        reason: 'local newer (LWW)',
      });
      toPush.push({ ...loc, googleTaskId: rem.googleTaskId });
      merged.push({ ...loc, googleTaskId: rem.googleTaskId });
    } else {
      conflicts.push({
        localId: loc.id,
        googleId: rem.googleTaskId!,
        winner: 'google',
        reason: 'google newer (LWW)',
      });
      const pulled = {
        ...loc,
        title: rem.title,
        notes: rem.notes ?? loc.notes,
        completed: rem.completed,
        due: rem.due,
        updatedAt: rem.updatedAt,
        googleTaskId: rem.googleTaskId,
      };
      toPull.push(pulled);
      merged.push(pulled);
    }
  }

  for (const rem of remoteMapped) {
    if (usedRemote.has(rem.googleTaskId!)) continue;
    toPull.push(rem);
    merged.push(rem);
  }

  return { toPush, toPull, conflicts, merged };
}
