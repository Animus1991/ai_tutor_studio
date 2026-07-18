/**
 * Google Calendar LWW snapshot — durable local persist for Workspace hub.
 */
import localforage from 'localforage';

const KEY = 'memora-calendar-snapshot';

export type CalendarSnapshotEvent = {
  id: string;
  summary: string;
  start: string;
  end?: string;
  htmlLink?: string;
};

export type CalendarSnapshot = {
  version: number;
  updatedAt: string;
  events: CalendarSnapshotEvent[];
};

export async function loadCalendarSnapshot(): Promise<CalendarSnapshot | null> {
  const snap = await localforage.getItem<CalendarSnapshot>(KEY);
  return snap?.version ? snap : null;
}

/** Merge by event id; bump version on every successful write. */
export async function persistCalendarSnapshot(
  events: CalendarSnapshotEvent[],
): Promise<CalendarSnapshot> {
  const prev = await loadCalendarSnapshot();
  const byId = new Map<string, CalendarSnapshotEvent>();
  for (const e of prev?.events ?? []) byId.set(e.id, e);
  for (const e of events) byId.set(e.id, e);
  const next: CalendarSnapshot = {
    version: (prev?.version ?? 0) + 1,
    updatedAt: new Date().toISOString(),
    events: [...byId.values()].slice(0, 100),
  };
  await localforage.setItem(KEY, next);
  return next;
}
