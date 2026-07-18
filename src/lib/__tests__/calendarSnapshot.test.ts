import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('localforage', () => {
  const store = new Map<string, unknown>();
  return {
    default: {
      getItem: vi.fn(async (key: string) => store.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
    },
  };
});

import { loadCalendarSnapshot, persistCalendarSnapshot } from '../calendarSnapshot';

describe('calendarSnapshot', () => {
  beforeEach(async () => {
    const { default: localforage } = await import('localforage');
    await localforage.setItem('memora-calendar-snapshot', null);
  });

  it('persists versioned events and merges by id', async () => {
    const a = await persistCalendarSnapshot([
      { id: '1', summary: 'Chem', start: '2026-01-01T10:00:00Z' },
    ]);
    expect(a.version).toBe(1);
    const b = await persistCalendarSnapshot([
      { id: '1', summary: 'Chem II', start: '2026-01-01T11:00:00Z' },
    ]);
    expect(b.version).toBe(2);
    expect(b.events[0]?.summary).toBe('Chem II');
    const loaded = await loadCalendarSnapshot();
    expect(loaded?.events).toHaveLength(1);
  });
});
